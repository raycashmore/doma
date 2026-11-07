import SwiftUI
import UIKit

/// Shows the lock screen and privacy cover in a window of their own, because a sheet or alert
/// presents above anything in the app's view tree. The app stays alive underneath, so an open
/// sheet keeps its unsaved edits through a lock.
struct SceneCover: UIViewRepresentable {
  let lock: AppLockController
  // Passed in from `body` so SwiftUI updates the anchor when they change. The anchor reads `lock`
  // itself, because a scene notification can arrive before that update.
  let isLocked: Bool
  let hidesContent: Bool
  /// False on the sign-in screen, which has nothing to hide and whose web sign-in must stay visible.
  let hasPrivateContent: Bool

  func makeUIView(context: Context) -> SceneCoverAnchor {
    SceneCoverAnchor(lock: lock)
  }

  func updateUIView(_ anchor: SceneCoverAnchor, context: Context) {
    anchor.hasPrivateContent = hasPrivateContent
    anchor.applyCover()
  }

  static func dismantleUIView(_ anchor: SceneCoverAnchor, coordinator: ()) {
    anchor.removeCover()
  }
}

/// Finds the scene through its place in the app's window, and owns that scene's cover window.
final class SceneCoverAnchor: UIView {
  var hasPrivateContent = false

  private let lock: AppLockController
  private var coverWindow: UIWindow?
  private var isSceneActive = false
  /// Always on screen behind the app, in the cover's colour. The iPad simulator fades in a capture of
  /// the app's window on return, under the cover, so that window goes transparent while covered.
  /// Without something behind it, the screen flashes black as the scene deactivates.
  private var backdropWindow: UIWindow?

  init(lock: AppLockController) {
    self.lock = lock
    super.init(frame: .zero)
    isUserInteractionEnabled = false
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("SceneCoverAnchor is created in code")
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if coverWindow == nil, let scene = window?.windowScene { install(in: scene) }
  }

  func applyCover() {
    guard let coverWindow, let window else { return }
    Self.apply(
      isCovered: lock.coversScene(isActive: isSceneActive, hasPrivateContent: hasPrivateContent),
      isLocked: lock.isLocked,
      window: window,
      coverWindow: coverWindow
    )
  }

  /// The order matters: the cover goes up before the app's window empties, and comes down after it
  /// is back, so the app never shows bare.
  static func apply(isCovered: Bool, isLocked: Bool, window: UIWindow, coverWindow: UIWindow) {
    if isCovered { coverWindow.isHidden = false }
    window.alpha = isCovered ? 0 : 1
    // Only the lock takes focus: Face ID and Control Centre also deactivate the scene.
    window.accessibilityElementsHidden = isLocked
    let keyWindow = isLocked ? coverWindow : window
    if !keyWindow.isKeyWindow { keyWindow.makeKey() }
    if !isCovered { coverWindow.isHidden = true }
  }

  func removeCover() {
    NotificationCenter.default.removeObserver(self)
    coverWindow?.isHidden = true
    coverWindow = nil
    backdropWindow?.isHidden = true
    backdropWindow = nil
  }

  private func install(in scene: UIWindowScene) {
    let controller = UIHostingController(rootView: CoverContent(lock: lock))
    // Opaque before SwiftUI first draws, in case the app switcher snapshot gets there first.
    controller.view.backgroundColor = UIColor(DomaColor.warmBgCardSoft)
    let coverWindow = UIWindow(windowScene: scene)
    coverWindow.windowLevel = .alert + 1
    coverWindow.rootViewController = controller
    self.coverWindow = coverWindow

    let backdropWindow = UIWindow(windowScene: scene)
    backdropWindow.windowLevel = .normal - 1
    backdropWindow.rootViewController = UIViewController()
    backdropWindow.rootViewController?.view.backgroundColor = UIColor(DomaColor.warmBgCardSoft)
    backdropWindow.isUserInteractionEnabled = false
    backdropWindow.isHidden = false
    self.backdropWindow = backdropWindow

    isSceneActive = scene.activationState == .foregroundActive

    // Notifications, not scenePhase: the cover must be up before the snapshot, and scenePhase can lag.
    let center = NotificationCenter.default
    center.addObserver(self, selector: #selector(sceneWillDeactivate), name: UIScene.willDeactivateNotification, object: scene)
    center.addObserver(self, selector: #selector(sceneDidActivate), name: UIScene.didActivateNotification, object: scene)
    center.addObserver(self, selector: #selector(sceneDidEnterBackground), name: UIScene.didEnterBackgroundNotification, object: scene)
    center.addObserver(self, selector: #selector(sceneDidDisconnect), name: UIScene.didDisconnectNotification, object: scene)
    applyCover()
  }

  @objc private func sceneWillDeactivate() {
    isSceneActive = false
    applyCover()
  }

  @objc private func sceneDidActivate() {
    isSceneActive = true
    applyCover()
  }

  /// The keyboard sits above every app window, so it has to go before a lock can appear.
  @objc private func sceneDidEnterBackground() {
    window?.endEditing(true)
  }

  @objc private func sceneDidDisconnect() {
    removeCover()
  }
}

private struct CoverContent: View {
  let lock: AppLockController

  var body: some View {
    if lock.isLocked {
      LockedView(lock: lock)
    } else {
      PrivacyCover()
    }
  }
}
