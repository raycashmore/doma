/// When Doma must ask for Face ID (or the device passcode) again.
/// Locked on cold launch, and after the app spends `backgroundTimeout` or longer in the background.
nonisolated struct AppLock {
  static let backgroundTimeout: Duration = .seconds(5 * 60)

  private(set) var isLocked = true
  private(set) var hasUnlocked = false
  private var backgroundedAt: ContinuousClock.Instant?

  /// Also true from entering the background until the lock is re-checked, so nothing shows in between.
  var hidesContent: Bool { isLocked || backgroundedAt != nil }

  /// The lock always covers a scene. An inactive one is covered only when it has something private.
  func coversScene(isActive: Bool, hasPrivateContent: Bool) -> Bool {
    hidesContent || (hasPrivateContent && !isActive)
  }

  mutating func enterBackground(at now: ContinuousClock.Instant) {
    backgroundedAt = now
  }

  /// Returns true when the app comes back from the background locked, so it should prompt.
  mutating func returnToForeground(at now: ContinuousClock.Instant) -> Bool {
    defer { backgroundedAt = nil }
    guard let backgroundedAt else { return false }
    if now - backgroundedAt >= Self.backgroundTimeout {
      isLocked = true
    }
    return isLocked
  }

  mutating func unlock() {
    isLocked = false
    hasUnlocked = true
    backgroundedAt = nil
  }
}
