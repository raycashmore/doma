import Testing
import UIKit

@testable import Doma

@MainActor
struct SceneCoverTests {
  private let window: UIWindow
  private let coverWindow: UIWindow

  init() throws {
    let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
    window = UIWindow(windowScene: scene)
    coverWindow = UIWindow(windowScene: scene)
    window.isHidden = false
    coverWindow.isHidden = true
  }

  private func apply(isCovered: Bool, isLocked: Bool = false) {
    SceneCoverAnchor.apply(isCovered: isCovered, isLocked: isLocked, window: window, coverWindow: coverWindow)
  }

  @Test func coveringShowsTheCoverAndEmptiesTheAppWindow() {
    apply(isCovered: true)

    #expect(!coverWindow.isHidden)
    #expect(window.alpha == 0)
  }

  @Test func uncoveringRestoresTheAppWindow() {
    apply(isCovered: true)
    apply(isCovered: false)

    #expect(coverWindow.isHidden)
    #expect(window.alpha == 1)
  }

  @Test func unlockingRestoresTheAppWindowAndItsAccessibility() {
    apply(isCovered: true, isLocked: true)
    #expect(window.accessibilityElementsHidden)

    apply(isCovered: false)

    #expect(window.alpha == 1)
    #expect(!window.accessibilityElementsHidden)
  }

  @Test func onlyTheLockTakesFocus() {
    apply(isCovered: true, isLocked: true)
    #expect(coverWindow.isKeyWindow)

    apply(isCovered: false)
    #expect(window.isKeyWindow)
  }
}
