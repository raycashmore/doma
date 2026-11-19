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

  public struct Issued: Decodable, Sendable {
    public let token: String
    /// Milliseconds since 1970, as Convex sends it.
    public let expiresAt: Double

    public init(token: String, expiresAt: Double) {
      self.token = token
      self.expiresAt = expiresAt
    }
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
  private var cached: Issued?
  private var exchanging: Task<Issued, any Error>?
  /// Bumped by `forget()`, so an exchange that started before it cannot bring the login back.
  private var generation = 0

  public init(keychain: DomaDeviceKeychain, transport: Transport, now: @escaping @Sendable () -> Date = { .now }) {
    self.keychain = keychain
    self.transport = transport
    self.now = now
  }

  /// Whether this device has a login. A locked keychain counts as unreachable, not signed out.
  public func isLinked() throws(Failure) -> Bool {
    do {
      return try keychain.read() != nil
    } catch {
      throw .unreachable
    }
  }

  /// Links this device with a Clerk `convex` token, replacing any previous login.
  public func link(clerkToken: String, label: String) async throws(Failure) {
    let credential: DomaDeviceKeychain.Credential
    do {
      credential = try await transport.link(clerkToken, label)
    } catch DomaConvexHTTPError.unauthenticated {
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
    if !forceRefresh, let cached, Date(timeIntervalSince1970: cached.expiresAt / 1000) > now().addingTimeInterval(Self.refreshMargin) {
      return cached.token
    }
    let credential: DomaDeviceKeychain.Credential
    do {
      guard let stored = try keychain.read() else { throw Failure.notLinked }
      credential = stored
    } catch let failure as Failure {
      throw failure
    } catch {
      throw .unreachable
    }

    let task: Task<Issued, any Error>
    if let exchanging {
      task = exchanging
    } else {
      let transport = transport
      task = Task { () throws -> Issued in
        switch try await transport.exchange(credential.secret) {
        case .issued(let issued): return issued
        case .rejected: throw Failure.rejected
        }
      }
      exchanging = task
    }
    let started = generation
    defer { if started == generation { exchanging = nil } }
    do {
      let issued = try await task.value
      guard started == generation else { throw Failure.notLinked }
      cached = issued
      return issued.token
    } catch Failure.rejected {
      // Only forget the login the server refused, not one linked since.
      if started == generation, (try? keychain.read()) == credential { forget() }
      throw .rejected
    } catch Failure.notLinked {
      throw .notLinked
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
    generation += 1
    cached = nil
    exchanging = nil
    keychain.delete()
  }
}
