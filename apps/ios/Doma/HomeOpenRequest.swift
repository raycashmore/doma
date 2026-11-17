import DomaKit
import Foundation
import Observation

/// A Home widget tap: Home itself, or one noticeboard card to open once the board has loaded.
@Observable
final class HomeOpenRequest {
  /// The card to open, such as `manualNote:<id>`. Home clears it once the board has loaded.
  var boardItemId: String?
  /// Counts the links opened, so the tab bar moves to Home even for a link it already followed.
  private(set) var openCount = 0

  func open(_ url: URL) {
    guard let link = DomaHomeLink(url: url) else { return }
    if case .item(let id) = link {
      boardItemId = id
    } else {
      boardItemId = nil
    }
    openCount += 1
  }
}
