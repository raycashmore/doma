import Observation

/// Refreshing navigation bars rebuilds the Lists screen, which would throw away an open edit sheet.
/// A screen holds the refresh while its sheet is open, and the refresh runs once it clears.
@MainActor
@Observable
final class NavigationBarRefreshHold {
  var isHeld = false
  private(set) var isRefreshPending = false

  /// Returns whether to refresh now. A held refresh stays pending until the hold clears.
  func requestRefresh() -> Bool {
    isRefreshPending = isHeld
    return !isHeld
  }
}
