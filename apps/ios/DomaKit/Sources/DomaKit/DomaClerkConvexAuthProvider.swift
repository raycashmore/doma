import ClerkKit
@preconcurrency import ConvexMobile

/// Supplies Convex with tokens from Doma's explicit `convex` Clerk JWT template.
///
/// `clerk-convex-swift` requests Clerk's default session token, which lacks the
/// `aud: convex` claim Doma's Convex auth config requires. Tokens are never persisted or logged.
@MainActor
public final class DomaClerkConvexAuthProvider: AuthProvider {
  public typealias T = String

  static let convexJWTTemplate = "convex"

  public init() {}

  public func login(onIdToken: @Sendable @escaping (String?) -> Void) async throws -> String {
    try await fetchToken(skipCache: true)
  }

  public func loginFromCache(onIdToken: @Sendable @escaping (String?) -> Void) async throws -> String {
    try await fetchToken(skipCache: false)
  }

  public func logout() async throws {
    if Clerk.shared.session != nil {
      try await Clerk.shared.auth.signOut()
    }
  }

  public nonisolated func extractIdToken(from authResult: String) -> String {
    authResult
  }

  private func fetchToken(skipCache: Bool) async throws -> String {
    guard let session = Clerk.shared.session, session.status == .active else {
      throw DomaAuthError.noActiveSession
    }
    let options = Session.GetTokenOptions(template: Self.convexJWTTemplate, skipCache: skipCache)
    guard let token = try await session.getToken(options) else {
      throw DomaAuthError.noToken
    }
    return token
  }
}

public enum DomaAuthError: Error, Equatable {
  case noActiveSession
  case noToken
}
