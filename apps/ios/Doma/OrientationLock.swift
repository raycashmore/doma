import UIKit

/// Holds iPhone in landscape while a screen that needs the width is open, such as the full-screen
/// Spending chart. iPad keeps every orientation.
@MainActor
enum OrientationLock {
  /// `nil` leaves the orientations in the Info.plist.
  private(set) static var mask: UIInterfaceOrientationMask?

  static func landscape() { apply(.landscape, turningTo: .landscape) }

  static func release() { apply(nil, turningTo: .portrait) }

  private static func apply(_ newMask: UIInterfaceOrientationMask?, turningTo orientations: UIInterfaceOrientationMask) {
    guard UIDevice.current.userInterfaceIdiom == .phone, newMask != mask else { return }
    mask = newMask
    for case let scene as UIWindowScene in UIApplication.shared.connectedScenes {
      for window in scene.windows {
        window.rootViewController?.setNeedsUpdateOfSupportedInterfaceOrientations()
      }
      scene.requestGeometryUpdate(.iOS(interfaceOrientations: orientations))
    }
  }
}

/// Answers UIKit's orientation question from `OrientationLock`.
final class DomaAppDelegate: NSObject, UIApplicationDelegate {
  func application(
    _ application: UIApplication, supportedInterfaceOrientationsFor window: UIWindow?
  ) -> UIInterfaceOrientationMask {
    OrientationLock.mask ?? (UIDevice.current.userInterfaceIdiom == .pad ? .all : .allButUpsideDown)
  }
}
