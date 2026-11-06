import SwiftUI

@main
struct DomaApp: App {
  @State private var session: DomaSession? = DomaApp.makeSession()
  @State private var lock = AppLockController()
  @Environment(\.scenePhase) private var scenePhase

  init() {
    DomaTheme.applyNavigationBarAppearance()
  }

  var body: some Scene {
    WindowGroup {
      if let session {
        ZStack {
          // No list data loads before the first unlock. After that the app stays alive under the lock.
          if lock.hasUnlocked {
            RootView(session: session)
          } else {
            PrivacyCover()
          }
        }
        .background {
          SceneCover(
            lock: lock,
            isLocked: lock.isLocked,
            hidesContent: lock.hidesContent,
            hasPrivateContent: session.phase != .signedOut
          )
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
