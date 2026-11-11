import ClerkKit
import DomaKit
import Foundation
import OSLog

/// Reads list data in the widget process: the shared Clerk session supplies a Convex token,
/// and one HTTP query fetches the snapshot.
@MainActor
enum WidgetListLoader {
  private static let logger = Logger(subsystem: "com.doma.app", category: "widget")
  private static var configured: DomaConfiguration?

  static func loadDefaultList() async -> ListSnapshotEntry.Content {
    guard let configuration = configure(), let query = DomaConvexHTTPQuery(deploymentURL: configuration.convexURL) else {
      return .message("Doma is not configured.")
    }
    do {
      guard let token = try await convexToken() else { return .message("Sign in to Doma.") }
      let defaultList: DomaDefaultList? = try await query.run("lists/queries:getDefaultList", args: [:], token: token)
      guard let defaultList else { return .message("No default list.") }
      let snapshot: DomaWidgetSnapshot? = try await query.run(
        "lists/widget:getSnapshot", args: ["publicId": defaultList.publicId], token: token)
      guard let snapshot else { return .message("List not available.") }
      logger.info("Loaded widget snapshot with \(snapshot.activeItems.count, privacy: .public) items")
      return .snapshot(name: snapshot.list.name, items: snapshot.activeItems.map(\.title))
    } catch {
      logger.error("Widget load failed: \(String(describing: error), privacy: .public)")
      return .message("Couldn't load the list.")
    }
  }

  private static func configure() -> DomaConfiguration? {
    if let configured { return configured }
    guard let configuration = DomaConfiguration.fromBundle() else { return nil }
    Clerk.configure(
      publishableKey: configuration.clerkPublishableKey,
      options: .init(telemetryEnabled: false, keychainConfig: configuration.clerkKeychain)
    )
    configured = configuration
    return configuration
  }

  private static func convexToken() async throws -> String? {
    for _ in 0..<50 where !Clerk.shared.isLoaded {
      try await Task.sleep(for: .milliseconds(100))
    }
    guard Clerk.shared.isLoaded else { logger.error("Clerk did not load"); return nil }
    guard let session = Clerk.shared.session, session.status == .active else {
      logger.info("No active Clerk session in the widget")
      return nil
    }
    return try await session.getToken(.init(template: "convex"))
  }
}
