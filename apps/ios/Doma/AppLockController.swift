import LocalAuthentication
import Observation
import SwiftUI

/// Applies `AppLock` to the scene lifecycle and asks for Face ID with a passcode fallback.
/// It gates the interface only: the Clerk session stays stored while locked.
@Observable
final class AppLockController {
  private var lock = AppLock()
  private var isAwaitingLaunchPrompt = true
  private var isLockDisabled = false
  private(set) var isAuthenticating = false

  var isLocked: Bool { lock.isLocked }

  init() {
    #if DEBUG && targetEnvironment(simulator)
    if SimulatorLaunch.skipsAppLock {
      lock.unlock()
      isLockDisabled = true
    }
    #endif
  }

  /// Prompts only once the scene is active: on cold launch, and on returning from the background locked.
  func scenePhaseChanged(to phase: ScenePhase) {
    guard !isLockDisabled else { return }
    switch phase {
    case .background:
      lock.enterBackground(at: .now)
    case .active:
      let shouldPrompt = lock.returnToForeground(at: .now) || isAwaitingLaunchPrompt
      isAwaitingLaunchPrompt = false
      if shouldPrompt {
        Task { await unlock() }
      }
    default:
      break
    }
  }

  func unlock() async {
    guard lock.isLocked, !isAuthenticating else { return }
    isAuthenticating = true
    defer { isAuthenticating = false }
    do {
      if try await LAContext().evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Unlock Doma") {
        lock.unlock()
      }
    } catch LAError.passcodeNotSet {
      // Without a device passcode there is nothing to authenticate against.
      lock.unlock()
    } catch {
      // Cancelled or failed: stay locked until the person taps Unlock.
    }
  }
}
