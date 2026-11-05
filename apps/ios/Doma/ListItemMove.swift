import DomaKit
import SwiftUI

/// One item moved within the active order, in the terms `reorderListItem` expects.
struct ListItemMove: Equatable {
  let itemId: String
  let targetIndex: Int
  let reorderedItems: [DomaListItem]

  /// Takes the offsets `onMove` supplies. `nil` when nothing would change.
  init?(items: [DomaListItem], from source: IndexSet, to destination: Int) {
    guard let first = source.first, (0...items.count).contains(destination) else { return nil }
    var reordered = items
    reordered.move(fromOffsets: source, toOffset: destination)
    guard reordered != items, let targetIndex = reordered.firstIndex(of: items[first]) else { return nil }
    itemId = items[first].id
    self.targetIndex = targetIndex
    reorderedItems = reordered
  }
}
