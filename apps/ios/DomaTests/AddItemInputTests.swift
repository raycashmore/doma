import Testing

@testable import Doma

@MainActor
struct AddItemInputTests {
  @Test func typingIsLeftAlone() {
    #expect(AddItemInput(from: "mil", to: "milk") == .typed)
    // Predictive text inserts a whole word at once, and a single word is not a paste.
    #expect(AddItemInput(from: "oat ", to: "oat milk ") == .typed)
  }

  @Test func returnSubmitsTheTitle() {
    #expect(AddItemInput(from: "milk", to: "milk\n") == .submit("milk"))
    // Autocorrection can land in the same edit as Return.
    #expect(AddItemInput(from: "teh", to: "the\n") == .submit("the"))
    #expect(AddItemInput(from: "", to: "Milk, 2L\n\n") == .submit("Milk, 2L"))
  }

  @Test func pastingSeveralLinesPreviewsThemAndRestoresTheField() {
    let input = AddItemInput(from: "", to: "bread\nmilk\noats")
    #expect(input == .paste(PastedItems(parsing: "bread\nmilk\noats"), restoring: ""))
  }

  @Test func onlyTheInsertedTextIsParsed() {
    // A list pasted after half-typed text previews only the paste, and the typed text comes back.
    let input = AddItemInput(from: "eg", to: "egbread, milk, oats")
    #expect(input == .paste(PastedItems(parsing: "bread, milk, oats"), restoring: "eg"))
  }

  @Test func pastingOneItemAcrossLinesJoinsThemAsText() {
    #expect(AddItemInput(from: "", to: "Dairy\n☐milk") == .replace("Dairy ☐milk"))
  }
}
