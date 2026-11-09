import Testing

@testable import Doma

@MainActor
struct SubmittedItemsTests {
  @Test func oneTitleStaysOne() {
    #expect(SubmittedItems.titles(in: "oat milk") == ["oat milk"])
  }

  @Test func everyCommaSplits() {
    #expect(SubmittedItems.titles(in: "milk, eggs") == ["milk", "eggs"])
    #expect(SubmittedItems.titles(in: "milk,eggs,, bread,") == ["milk", "eggs", "bread"])
  }

  @Test func everyLineSplits() {
    #expect(SubmittedItems.titles(in: "bread\nmilk, eggs\n- oats") == ["bread", "milk", "eggs", "oats"])
  }

  @Test func blankInputAddsNothing() {
    #expect(SubmittedItems.titles(in: " , \n ").isEmpty)
  }
}
