import SwiftUI

@main
struct DomaApp: App {
  @State private var session: DomaSession? = DomaApp.makeSession()

  var body: some Scene {
    WindowGroup {
      if let session {
        RootView(session: session)
      } else if !DomaApp.isHostingTests {
        ConfigurationMissingView()
      }
    }
  }

  /// Hosted test runs drive Clerk and Convex themselves, so the app stays idle.
  private static var isHostingTests: Bool {
    ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
  }

  private static func makeSession() -> DomaSession? {
    guard !isHostingTests, let configuration = DomaConfiguration.fromBundle() else { return nil }
    return DomaSession(configuration: configuration)
  }
}
