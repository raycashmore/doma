import Foundation

/// This device's Doma login, shared by the app and the widget.
///
/// A Clerk sign-in links the device once (`devices/login:link`); after that the stored secret is
/// swapped for an hour-long Convex token (`devices/login:exchange`), so the device stays signed in
/// past Clerk's session limit. Only an explicit rejection from the exchange ends the login; a network
/// or server failure keeps it. Secrets and tokens never reach a log or an error.
public actor DomaDeviceLogin {
  public enum Failure: Error, Equatable {
    /// This device has no login. The app shows sign-in; the widget shows "Signed out".
    case notLinked
    /// The server refused the login (revoked, unused for 60 days, or the account is gone). It has
    /// been forgotten here.
    case rejected
    /// Anything that may pass: no connection, a locked keychain, a server fault.
    case unreachable
  }

  public struct Issued: Decodable, Sendable, CustomStringConvertible, CustomDebugStringConvertible {
    public let token: String
    /// Milliseconds since 1970, as Convex sends it.
    public let expiresAt: Double

    public init(token: String, expiresAt: Double) {
      self.token = token
      self.expiresAt = expiresAt
    }

    /// Never the token, so printing one by mistake reveals nothing.
    public var description: String { "Issued(token: <redacted>)" }
    public var debugDescription: String { description }
  }

  public enum ExchangeResult: Sendable {
    case issued(Issued)
    case rejected
  }

  /// The server calls, injectable for tests.
  public struct Transport: Sendable {
    public var link: @Sendable (_ clerkToken: String, _ label: String) async throws -> DomaDeviceKeychain.Credential
    public var exchange: @Sendable (_ secret: String) async throws -> ExchangeResult
    public var revoke: @Sendable (_ deviceId: String, _ token: String) async throws -> Void

    public init(
      link: @escaping @Sendable (String, String) async throws -> DomaDeviceKeychain.Credential,
      exchange: @escaping @Sendable (String) async throws -> ExchangeResult,
      revoke: @escaping @Sendable (String, String) async throws -> Void
    ) {
      self.link = link
      self.exchange = exchange
      self.revoke = revoke
    }

    public static func convex(deploymentURL: String) -> Transport? {
      // Short enough that sign-out and a widget refresh never wait long on a dead connection.
      let configuration = URLSessionConfiguration.ephemeral
      configuration.timeoutIntervalForRequest = 15
      let session = URLSession(configuration: configuration)
      guard
        let action = DomaConvexHTTPFunction(deploymentURL: deploymentURL, kind: .action, session: session),
        let mutation = DomaConvexHTTPFunction(deploymentURL: deploymentURL, kind: .mutation, session: session)
      else { return nil }
      return Transport(
        link: { clerkToken, label in
          try await action.run("devices/login:link", args: ["label": label], token: clerkToken)
        },
        exchange: { secret in
          let reply: ExchangeReply = try await action.run("devices/login:exchange", args: ["secret": secret], token: nil)
          if reply.status == "issued", let token = reply.token, let expiresAt = reply.expiresAt {
            return .issued(Issued(token: token, expiresAt: expiresAt))
          }
          if reply.status == "rejected" { return .rejected }
          throw DomaConvexHTTPError.failed(status: 200)
        },
        revoke: { deviceId, token in
          let _: Ignored? = try await mutation.run("devices/login:revoke", args: ["deviceId": deviceId], token: token)
        }
      )
    }

    private struct ExchangeReply: Decodable {
      let status: String
      let token: String?
      let expiresAt: Double?
    }

    private struct Ignored: Decodable {}
  }

  /// A token with less than this left is replaced before use.
  static let refreshMargin: TimeInterval = 5 * 60

  private let keychain: DomaDeviceKeychain
  private let transport: Transport
  private let now: @Sendable () -> Date
  /// The current token, the login it was issued for and the swap that issued it.
  private var cached: (issued: Issued, credential: DomaDeviceKeychain.Credential, exchangeId: Int)?
  private var exchanging: (id: Int, credential: DomaDeviceKeychain.Credential, task: Task<Issued, any Error>)?
  private var exchangeCount = 0
  /// Bumped when the login is forgotten, so an exchange that started before cannot bring it back.
  private var generation = 0

  public init(keychain: DomaDeviceKeychain, transport: Transport, now: @escaping @Sendable () -> Date = { .now }) {
    self.keychain = keychain
    self.transport = transport
    self.now = now
  }

  /// Whether this device has a login. A locked keychain counts as unreachable, not signed out.
  public func isLinked() throws(Failure) -> Bool {
    try storedCredential() != nil
  }

  /// Links this device with a Clerk `convex` token, replacing any previous login.
  public func link(clerkToken: String, label: String) async throws(Failure) {
    let credential: DomaDeviceKeychain.Credential
    do {
      credential = try await transport.link(clerkToken, label)
    } catch DomaConvexHTTPError.unauthenticated {
      // Only a definite refusal: anything else, such as a function not deployed yet, may pass.
      throw .rejected
    } catch {
      throw .unreachable
    }
    forget()
    do {
      try keychain.save(credential)
    } catch {
      throw .unreachable
    }
  }

  /// A Convex token for this device. Reuses the current one unless `forceRefresh` is set, which a
  /// caller does after Convex refused it.
  public func token(forceRefresh: Bool = false) async throws(Failure) -> String {
    // Read every time: the app or the widget may have forgotten the login since the token was
    // issued, and a long-lived widget process must not keep using it.
    guard let credential = try storedCredential() else {
      // Memory only: the other process may be mid-link, about to save a new login.
      dropMemory()
      throw .notLinked
    }
    if !forceRefresh, let cached, cached.credential == credential,
       Date(timeIntervalSince1970: cached.issued.expiresAt / 1000) > now().addingTimeInterval(Self.refreshMargin) {
      return cached.issued.token
    }

    let exchange: (id: Int, credential: DomaDeviceKeychain.Credential, task: Task<Issued, any Error>)
    if let exchanging, !forceRefresh, exchanging.credential == credential {
      exchange = exchanging
    } else {
      exchangeCount += 1
      let transport = transport
      exchange = (exchangeCount, credential, Task { () throws -> Issued in
        switch try await transport.exchange(credential.secret) {
        case .issued(let issued): return issued
        case .rejected: throw Failure.rejected
        }
      })
      exchanging = exchange
    }
    let started = generation
    defer { if exchanging?.id == exchange.id { exchanging = nil } }
    do {
      let issued = try await exchange.task.value
      guard started == generation else { throw Failure.notLinked }
      // A later swap's token wins, whichever finishes first.
      if exchange.id > (cached?.exchangeId ?? 0) { cached = (issued, exchange.credential, exchange.id) }
      return issued.token
    } catch Failure.rejected {
      // Only forget the login the server refused, not one linked since.
      if started == generation, (try? keychain.read()) == exchange.credential { forget() }
      throw .rejected
    } catch Failure.notLinked {
      throw .notLinked
    } catch {
      throw .unreachable
    }
  }

  private func storedCredential() throws(Failure) -> DomaDeviceKeychain.Credential? {
    do {
      return try keychain.read()
    } catch {
      throw .unreachable
    }
  }

  /// Revokes this device on the server, as far as the network allows, then forgets it here.
  public func signOut() async {
    if let credential = try? keychain.read(), let token = try? await token() {
      try? await transport.revoke(credential.deviceId, token)
    }
    forget()
  }

  /// Forgets the login on this device only.
  public func forget() {
    dropMemory()
    keychain.delete()
  }

  private func dropMemory() {
    generation += 1
    cached = nil
    exchanging = nil
  }
}
