import DomaKit
import Foundation
import Observation

/// A list a widget asked the app to open. It waits here until Lists can show it, which may be
/// after the app unlocks or finishes signing in.
@Observable
final class ListOpenRequest {
  var publicId: String?

  func open(_ url: URL) {
    guard let publicId = DomaListLink.publicId(from: url) else { return }
    LastOpenedList().remember(publicId)
    self.publicId = publicId
  }
}
