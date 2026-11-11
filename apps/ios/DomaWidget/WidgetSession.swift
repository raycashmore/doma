import ClerkKit
import DomaKit
import Foundation
import OSLog

/// Runs Convex queries in the widget process with the app's Clerk session, which the two
/// bundles share through the keychain access group in `Config/Doma.entitlements`.
@MainActor
enum WidgetSession {
  enum Failure: Error {
    /// No session, or Clerk or Convex rejected it. The widget must not show list data.
    case signedOut
    /// Anything that may pass: no connection, Clerk not loaded yet, a server error.
    case unreachable
  }

  private static let logger = Logger(subsystem: "com.doma.app", category: "widget")
  private static var configuration: DomaConfiguration?

  static func run<Value: Decodable & SendableMetatype>(_ path: String, args: [String: String] = [:]) async throws(Failure) -> Value {
    guard let configuration = configure(), let query = DomaConvexHTTPQuery(deploymentURL: configuration.convexURL) else {
      logger.error("Widget is not configured")
      throw .unreachable
    }
    let token = try await convexToken()
    do {
      return try await query.run(path, args: args, token: token)
    } catch DomaConvexHTTPQueryError.unauthenticated {
      logger.info("Convex rejected the widget's session")
      throw .signedOut
    } catch {
      logger.error("\(path, privacy: .public) failed: \(String(describing: error), privacy: .public)")
      throw .unreachable
    }
  }

  private static func configure() -> DomaConfiguration? {
    if let configuration { return configuration }
    guard let loaded = DomaConfiguration.fromBundle() else { return nil }
    Clerk.configure(
      publishableKey: loaded.clerkPublishableKey,
      options: .init(telemetryEnabled: false, keychainConfig: loaded.clerkKeychain)
    )
    configuration = loaded
    return loaded
  }

  private static func convexToken() async throws(Failure) -> String {
    for _ in 0..<50 where !Clerk.shared.isLoaded {
      try? await Task.sleep(for: .milliseconds(100))
    }
    guard Clerk.shared.isLoaded else { throw .unreachable }
    guard let session = Clerk.shared.session, session.status == .active else { throw .signedOut }
    let token: String?
    do {
      // Skips Clerk's minute-long token cache, so a widget process still running after the app
      // signs out cannot reuse a token the session no longer backs.
      token = try await session.getToken(.init(template: "convex", skipCache: true))
    } catch {
      logger.info("Clerk gave no token: \(String(describing: error), privacy: .public)")
      throw DomaClerkTokenFailure(error) == .signedOut ? .signedOut : .unreachable
    }
    guard let token else { throw .signedOut }
    return token
  }
}
