import DomaKit
import Foundation
import Testing

@testable import Doma

@MainActor
struct ListItemMoveTests {
  private let items = try! JSONDecoder().decode(
    [DomaListItem].self,
    from: Data(#"[{"_id":"a","title":"A"},{"_id":"b","title":"B"},{"_id":"c","title":"C"}]"#.utf8))

  @Test func movingDownTargetsTheItemsNewPosition() throws {
    // onMove reports the offset before removal, so dropping A below B arrives as 2.
    let move = try #require(ListItemMove(items: items, from: [0], to: 2))

    #expect(move.itemId == "a")
    #expect(move.targetIndex == 1)
    #expect(move.reorderedItems.map(\.id) == ["b", "a", "c"])
  }

  @Test func movingUpTargetsTheItemsNewPosition() throws {
    let move = try #require(ListItemMove(items: items, from: [2], to: 0))

    #expect(move.itemId == "c")
    #expect(move.targetIndex == 0)
    #expect(move.reorderedItems.map(\.id) == ["c", "a", "b"])
  }

  @Test func droppingAnItemWhereItStartedChangesNothing() {
    #expect(ListItemMove(items: items, from: [1], to: 1) == nil)
    #expect(ListItemMove(items: items, from: [1], to: 2) == nil)
  }

  @Test func movesPastEitherEndChangeNothing() {
    #expect(ListItemMove(items: items, from: [0], to: -1) == nil)
    #expect(ListItemMove(items: items, from: [2], to: 4) == nil)
  }
}
