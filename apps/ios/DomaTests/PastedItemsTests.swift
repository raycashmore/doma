import Testing

@testable import Doma

/// The cases of `apps/lists/src/lib/lists/paste-parser.test.ts`, so the two parsers cannot drift.
@MainActor
struct PastedItemsTests {
  @Test func splitsAFlatCommaSeparatedLineIntoOneItemPerValue() {
    let result = PastedItems(parsing: "bananas, apples, oats, milk")
    #expect(result.items == ["bananas", "apples", "oats", "milk"])
    #expect(result.headings.isEmpty)
  }

  @Test func keepsASingleLineWithOneCommaAsOneItem() {
    let result = PastedItems(parsing: "Milk, 2L")
    #expect(result.items == ["Milk, 2L"])
    #expect(result.headings.isEmpty)
  }

  @Test func keepsAPlainSingleWordAsOneItem() {
    #expect(PastedItems(parsing: "bananas").items == ["bananas"])
  }

  @Test func splitsOnNewlinesAndPreservesCommasInsideEachLine() {
    let result = PastedItems(parsing: "Milk, 2L\nbananas\nCall mum, then dad")
    #expect(result.items == ["Milk, 2L", "bananas", "Call mum, then dad"])
    #expect(result.headings.isEmpty)
  }

  @Test func stripsTrailingListPunctuationAndDropsTheEmptyTrailingLine() {
    let result = PastedItems(parsing: "bananas,\napples,\noats,\nmilk")
    #expect(result.items == ["bananas", "apples", "oats", "milk"])
    #expect(result.headings.isEmpty)
  }

  @Test func stripsLeadingCheckboxAndBulletMarkers() {
    let result = PastedItems(parsing: "☐avocados\n- bananas\n* broccoli\n• onions\n– potatoes")
    #expect(result.items == ["avocados", "bananas", "broccoli", "onions", "potatoes"])
    #expect(result.headings.isEmpty)
  }

  @Test func stripsNumberedListMarkers() {
    #expect(PastedItems(parsing: "1. eggs\n2. milk\n3. bread").items == ["eggs", "milk", "bread"])
  }

  @Test func treatsMarkerlessLinesAmongMarkedLinesAsHeadings() {
    let result = PastedItems(parsing: "Dairy\n☐milk\n☐eggs\nProduce\n☐bananas\n\n☐popping corn")
    #expect(result.items == ["milk", "eggs", "bananas", "popping corn"])
    #expect(result.headings == ["Dairy", "Produce"])
  }

  @Test func keepsEveryLineAsAnItemWhenNoLineHasAMarker() {
    let result = PastedItems(parsing: "bread\nmilk\noats")
    #expect(result.items == ["bread", "milk", "oats"])
    #expect(result.headings.isEmpty)
  }

  @Test func returnsNothingForEmptyOrWhitespaceOnlyInput() {
    #expect(PastedItems(parsing: "   \n  ").entries.isEmpty)
    #expect(PastedItems(parsing: "").entries.isEmpty)
  }

  @Test func parsesARealCategorisedShoppingListEndToEnd() {
    let result = PastedItems(
      parsing: [
        "Dairy", "☐milk", "☐eggs", "☐1 sour light cream", "Produce", "☐avocados", "☐brown onions", "",
        "☐popping corn",
      ].joined(separator: "\n"))
    #expect(result.items == ["milk", "eggs", "1 sour light cream", "avocados", "brown onions", "popping corn"])
    #expect(result.headings == ["Dairy", "Produce"])
  }

  @Test func splitsAFlatCheckboxListWithNoNewlines() {
    let result = PastedItems(parsing: "☐ milk ☐ eggs ☐ bread")
    #expect(result.items == ["milk", "eggs", "bread"])
    #expect(result.headings.isEmpty)
  }

  @Test func splitsAFlatCheckboxListWithGluedGlyphs() {
    #expect(PastedItems(parsing: "☐milk ☐eggs").items == ["milk", "eggs"])
  }

  @Test func splitsAFlatBulletListStrippingMarkersAndTrailingCommas() {
    let result = PastedItems(parsing: "- milk, - eggs, - bread")
    #expect(result.items == ["milk", "eggs", "bread"])
    #expect(result.headings.isEmpty)
  }

  @Test func splitsAFlatNumberedListWithNoNewlines() {
    #expect(PastedItems(parsing: "1. eggs 2. milk 3. bread").items == ["eggs", "milk", "bread"])
  }

  @Test func returnsOrderedEntriesWithHeadingsInTheirOriginalPositions() {
    #expect(
      PastedItems(parsing: "Dairy\n☐milk\nProduce\n☐avocados").entries == [
        .init(kind: .heading, text: "Dairy"),
        .init(kind: .item, text: "milk"),
        .init(kind: .heading, text: "Produce"),
        .init(kind: .item, text: "avocados"),
      ])
  }

  // iOS-only: pasteboards from other apps often use Windows line endings.
  @Test func splitsWindowsLineEndings() {
    #expect(PastedItems(parsing: "bread\r\nmilk\r\noats").items == ["bread", "milk", "oats"])
  }
}
