@preconcurrency import ConvexMobile
import DomaKit
import Foundation
import Security
import Synchronization
import Testing

/// Fake secrets and tokens only; each test uses its own keychain service and deletes it.
@MainActor
struct DomaDeviceLoginTests {
  private struct Unreachable: Error {}

  /// A stand-in server: counts swaps and answers with whatever the test sets.
  private final class FakeServer: Sendable {
    enum Answer { case issue, reject, fail }

    let answer = Mutex(Answer.issue)
    let exchanges = Mutex(0)
    let revoked = Mutex<[String]>([])
    let expiresIn: TimeInterval
    /// How long the first swap takes, so a test can overtake it.
    let firstDelay: Int

    init(expiresIn: TimeInterval = 3600, firstDelay: Int = 20) {
      self.expiresIn = expiresIn
      self.firstDelay = firstDelay
    }

    var transport: DomaDeviceLogin.Transport {
      DomaDeviceLogin.Transport(
        link: { _, _ in .init(deviceId: "device_1", secret: "fake-secret") },
        exchange: { [self] _ in
          let count = exchanges.withLock { count in
            count += 1
            return count
          }
          try await Task.sleep(for: .milliseconds(count == 1 ? firstDelay : 20))
          switch answer.withLock({ $0 }) {
          case .issue:
            let expiresAt = Date.now.addingTimeInterval(expiresIn).timeIntervalSince1970 * 1000
            return .issued(.init(token: "fake-token-\(count)", expiresAt: expiresAt))
          case .reject: return .rejected
          case .fail: throw Unreachable()
          }
        },
        revoke: { [self] deviceId, _ in revoked.withLock { $0.append(deviceId) } }
      )
    }
  }

  private let keychain = DomaDeviceKeychain(service: "com.doma.tests.device-login.\(UUID().uuidString)", accessGroup: nil)

  private func linked(_ server: FakeServer) async throws -> DomaDeviceLogin {
    let login = DomaDeviceLogin(keychain: keychain, transport: server.transport)
    try await login.link(clerkToken: "fake-clerk-token", label: "iPhone")
    return login
  }

  @Test func reusesATokenUntilItNearsExpiryAndSwapsWhenForced() async throws {
    let server = FakeServer()
    let login = try await linked(server)
    defer { keychain.delete() }

    #expect(try await login.token() == "fake-token-1")
    #expect(try await login.token() == "fake-token-1")
    #expect(try await login.token(forceRefresh: true) == "fake-token-2")
    #expect(server.exchanges.withLock { $0 } == 2)

    let shortLived = FakeServer(expiresIn: 60)
    let soonExpired = try await linked(shortLived)
    _ = try await soonExpired.token()
    _ = try await soonExpired.token()
    #expect(shortLived.exchanges.withLock { $0 } == 2)
  }

  @Test func concurrentCallersShareOneSwap() async throws {
    let server = FakeServer()
    let login = try await linked(server)
    defer { keychain.delete() }

    async let first = login.token()
    async let second = login.token()
    let tokens = try await [first, second]

    #expect(tokens == ["fake-token-1", "fake-token-1"])
    #expect(server.exchanges.withLock { $0 } == 1)
  }

  @Test func aLaterSwapsTokenWinsWhenAnEarlierOneFinishesLast() async throws {
    let server = FakeServer(firstDelay: 300)
    let login = try await linked(server)
    defer { keychain.delete() }

    async let earlier = login.token()
    try await Task.sleep(for: .milliseconds(50))
    // Convex refused a token meanwhile, so a forced swap overtakes the first.
    async let later = login.token(forceRefresh: true)
    _ = try await [earlier, later]

    #expect(try await login.token() == "fake-token-2")
  }

  @Test func aRejectedSwapForgetsTheLogin() async throws {
    let server = FakeServer()
    let login = try await linked(server)
    defer { keychain.delete() }
    server.answer.withLock { $0 = .reject }

    await #expect(throws: DomaDeviceLogin.Failure.rejected) { try await login.token() }
    #expect(try await login.isLinked() == false)
    await #expect(throws: DomaDeviceLogin.Failure.notLinked) { try await login.token() }
  }

  @Test func aNetworkFailureKeepsTheLogin() async throws {
    let server = FakeServer()
    let login = try await linked(server)
    defer { keychain.delete() }
    server.answer.withLock { $0 = .fail }

    await #expect(throws: DomaDeviceLogin.Failure.unreachable) { try await login.token() }
    #expect(try await login.isLinked())

    server.answer.withLock { $0 = .issue }
    #expect(try await login.token() == "fake-token-2")
  }

  @Test func withoutALoginThereIsNoToken() async throws {
    let login = DomaDeviceLogin(keychain: keychain, transport: FakeServer().transport)

    #expect(try await login.isLinked() == false)
    await #expect(throws: DomaDeviceLogin.Failure.notLinked) { try await login.token() }
  }

  @Test func signOutRevokesTheDeviceAndForgetsIt() async throws {
    let server = FakeServer()
    let login = try await linked(server)
    defer { keychain.delete() }

    await login.signOut()

    #expect(server.revoked.withLock { $0 } == ["device_1"])
    #expect(try await login.isLinked() == false)
  }

  @Test func storesTheLoginOnThisDeviceOnly() async throws {
    _ = try await linked(FakeServer())
    defer { keychain.delete() }

    let attributes = try #require(storedAttributes())
    #expect(attributes[kSecAttrAccessible as String] as? String == kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly as String)
    #expect((attributes[kSecAttrSynchronizable as String] as? NSNumber)?.boolValue != true)
  }

  @Test func aCachedTokenIsNotUsedOnceTheLoginIsForgottenElsewhere() async throws {
    let server = FakeServer()
    let login = try await linked(server)
    defer { keychain.delete() }
    _ = try await login.token()

    // The app signed out, or the widget saw a rejection, in another process.
    keychain.delete()

    await #expect(throws: DomaDeviceLogin.Failure.notLinked) { try await login.token() }
  }

  @Test func onlyADefiniteRefusalRejectsALink() async throws {
    func linkFailing(with error: DomaConvexHTTPError) async -> DomaDeviceLogin.Failure? {
      let transport = DomaDeviceLogin.Transport(
        link: { _, _ in throw error },
        exchange: { _ in .rejected },
        revoke: { _, _ in }
      )
      let login = DomaDeviceLogin(keychain: keychain, transport: transport)
      do {
        try await login.link(clerkToken: "fake-clerk-token", label: "iPhone")
        return nil
      } catch {
        return error
      }
    }

    #expect(await linkFailing(with: .unauthenticated) == .rejected)
    // A function not deployed yet, or a malformed request: retry, keeping the Clerk session.
    #expect(await linkFailing(with: .badRequest) == .unreachable)
    #expect(await linkFailing(with: .failed(status: 500)) == .unreachable)
  }

  @Test func theAuthProviderAlwaysSwapsWhenConvexRefusesAToken() async throws {
    let server = FakeServer()
    let login = try await linked(server)
    defer { keychain.delete() }
    let provider = DomaDeviceConvexAuthProvider(deviceLogin: login) {}

    #expect(try await provider.login { _ in } == "fake-token-1")
    #expect(try await provider.loginFromCache { _ in } == "fake-token-2")
  }

  @Test func theAuthProviderEndsTheSessionWhenTheWidgetForgotTheLogin() async throws {
    let server = FakeServer()
    let login = try await linked(server)
    defer { keychain.delete() }
    let ended = Mutex(0)
    let provider = DomaDeviceConvexAuthProvider(deviceLogin: login) { ended.withLock { $0 += 1 } }
    // The widget's own swap was rejected, so it deleted the shared keychain item.
    keychain.delete()

    await #expect(throws: DomaDeviceLogin.Failure.notLinked) { try await provider.loginFromCache { _ in } }
    #expect(ended.withLock { $0 } == 1)
  }

  @Test func theAuthProviderKeepsTheSessionThroughANetworkFailure() async throws {
    let server = FakeServer()
    let login = try await linked(server)
    defer { keychain.delete() }
    server.answer.withLock { $0 = .fail }
    let ended = Mutex(0)
    let provider = DomaDeviceConvexAuthProvider(deviceLogin: login) { ended.withLock { $0 += 1 } }

    await #expect(throws: DomaDeviceLogin.Failure.unreachable) { try await provider.loginFromCache { _ in } }
    #expect(ended.withLock { $0 } == 0)
  }

  @Test func theAuthProviderClearsTheTokenAndReportsARejection() async throws {
    let server = FakeServer()
    let login = try await linked(server)
    defer { keychain.delete() }
    server.answer.withLock { $0 = .reject }
    let pushed = Mutex<[String?]>([])
    let rejections = Mutex(0)
    let provider = DomaDeviceConvexAuthProvider(deviceLogin: login) { rejections.withLock { $0 += 1 } }

    await #expect(throws: DomaDeviceLogin.Failure.rejected) {
      try await provider.loginFromCache { token in pushed.withLock { $0.append(token) } }
    }
    #expect(pushed.withLock { $0 } == [nil])
    #expect(rejections.withLock { $0 } == 1)
  }

  private func storedAttributes() -> [String: Any]? {
    // Reads the item's attributes only, never its data.
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: keychainService,
      kSecAttrSynchronizable as String: kSecAttrSynchronizableAny,
      kSecUseDataProtectionKeychain as String: true,
      kSecReturnAttributes as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var result: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return nil }
    return result as? [String: Any]
  }

  private var keychainService: String { keychain.service }
}
