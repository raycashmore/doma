import SwiftUI

/// One row moved within an ordered list, in the terms the reorder mutations expect.
struct OrderMove<Element: Identifiable & Equatable>: Equatable where Element.ID == String {
  let movedId: String
  let targetIndex: Int
  let reordered: [Element]

  /// Takes the offsets `onMove` supplies. `nil` when nothing would change.
  init?(_ elements: [Element], from source: IndexSet, to destination: Int) {
    guard let first = source.first, (0...elements.count).contains(destination) else { return nil }
    var reordered = elements
    reordered.move(fromOffsets: source, toOffset: destination)
    guard reordered != elements, let targetIndex = reordered.firstIndex(of: elements[first]) else { return nil }
    movedId = elements[first].id
    self.targetIndex = targetIndex
    self.reordered = reordered
  }
}
