import Observation

/// Refreshing navigation bars rebuilds the Lists screen, which would throw away an open edit sheet.
/// A screen sets this while it has unsaved work, and the refresh runs once it clears.
@MainActor
@Observable
final class NavigationBarRefreshHold {
  var isHeld = false
}
