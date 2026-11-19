@preconcurrency import ConvexMobile

/// Supplies `ConvexClientWithAuth` with this device's Doma tokens.
///
/// `login` reuses a token with time left. ConvexMobile calls `loginFromCache` only after Convex
/// refused the current token, so it always swaps for a new one: handing the refused token back
/// would retry it forever. When the device login has ended (the server rejected it, or the widget
/// did and forgot it) this clears the client's token and calls `onEnded`.
public final class DomaDeviceConvexAuthProvider: AuthProvider, Sendable {
  public typealias T = String

  private let deviceLogin: DomaDeviceLogin
  private let onEnded: @Sendable () async -> Void

  public init(deviceLogin: DomaDeviceLogin, onEnded: @escaping @Sendable () async -> Void) {
    self.deviceLogin = deviceLogin
    self.onEnded = onEnded
  }

  public func login(onIdToken: @Sendable @escaping (String?) -> Void) async throws -> String {
    try await token(forceRefresh: false, onIdToken: onIdToken)
  }

  public func loginFromCache(onIdToken: @Sendable @escaping (String?) -> Void) async throws -> String {
    try await token(forceRefresh: true, onIdToken: onIdToken)
  }

  /// Signs out of Convex only. Revoking the device is `DomaDeviceLogin.signOut()`, which the session
  /// runs first, since it needs a token.
  public func logout() async throws {}

  public func extractIdToken(from authResult: String) -> String {
    authResult
  }

  private func token(forceRefresh: Bool, onIdToken: @Sendable (String?) -> Void) async throws -> String {
    do {
      return try await deviceLogin.token(forceRefresh: forceRefresh)
    } catch .unreachable {
      throw DomaDeviceLogin.Failure.unreachable
    } catch {
      // Throwing alone is not enough: ConvexMobile would keep the refused token.
      onIdToken(nil)
      await onEnded()
      throw error
    }
  }
}
