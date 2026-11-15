import DomaKit
import Foundation
import Observation

/// A list a widget asked the app to open. It waits here until Lists can show it, which may be
/// after the app unlocks or finishes signing in.
@Observable
final class ListOpenRequest {
  var publicId: String?
  /// Counts the links opened. Lists clears `publicId` as soon as it shows the list, often before
  /// anything else sees it change, so the tab bar follows this count instead.
  private(set) var openCount = 0

  func open(_ url: URL) {
    guard let publicId = DomaListLink.publicId(from: url) else { return }
    LastOpenedList().remember(publicId)
    self.publicId = publicId
    openCount += 1
  }
}
