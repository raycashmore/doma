/// When Doma must ask for Face ID (or the device passcode) again.
/// Locked on cold launch, and after the app spends `backgroundTimeout` or longer in the background.
nonisolated struct AppLock {
  static let backgroundTimeout: Duration = .seconds(5 * 60)

  private(set) var isLocked = true
  private var backgroundedAt: ContinuousClock.Instant?

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
    backgroundedAt = nil
  }
}
