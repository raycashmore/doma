import SwiftUI

@main
struct DomaApp: App {
  @State private var session: DomaSession? = DomaApp.makeSession()
  @State private var lock = AppLockController()
  @Environment(\.scenePhase) private var scenePhase

  var body: some Scene {
    WindowGroup {
      if let session {
        if lock.isLocked {
          LockedView(lock: lock)
        } else {
          RootView(session: session)
            // Keeps household data out of the app switcher and hidden until the lock is re-checked.
            .overlay {
              if scenePhase != .active {
                PrivacyCover()
              }
            }
        }
      } else if !DomaApp.isHostingTests {
        ConfigurationMissingView()
      }
    }
    .onChange(of: scenePhase, initial: true) { _, phase in
      lock.scenePhaseChanged(to: phase)
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
