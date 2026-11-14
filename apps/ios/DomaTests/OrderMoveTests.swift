import DomaKit
import Foundation
import Testing

@testable import Doma

@MainActor
struct OrderMoveTests {
  private let items = try! JSONDecoder().decode(
    [DomaListItem].self,
    from: Data(#"[{"_id":"a","title":"A","propertyValues":[]},{"_id":"b","title":"B","propertyValues":[]},{"_id":"c","title":"C","propertyValues":[]}]"#.utf8))

  @Test func movingDownTargetsTheItemsNewPosition() throws {
    // onMove reports the offset before removal, so dropping A below B arrives as 2.
    let move = try #require(OrderMove(items, from: [0], to: 2))

    #expect(move.movedId == "a")
    #expect(move.targetIndex == 1)
    #expect(move.reordered.map(\.id) == ["b", "a", "c"])
  }

  @Test func movingUpTargetsTheItemsNewPosition() throws {
    let move = try #require(OrderMove(items, from: [2], to: 0))

    #expect(move.movedId == "c")
    #expect(move.targetIndex == 0)
    #expect(move.reordered.map(\.id) == ["c", "a", "b"])
  }

  @Test func droppingAnItemWhereItStartedChangesNothing() {
    #expect(OrderMove(items, from: [1], to: 1) == nil)
    #expect(OrderMove(items, from: [1], to: 2) == nil)
  }

  @Test func movesPastEitherEndChangeNothing() {
    #expect(OrderMove(items, from: [0], to: -1) == nil)
    #expect(OrderMove(items, from: [2], to: 4) == nil)
  }
}
