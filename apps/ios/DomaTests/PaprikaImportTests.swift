import DomaKit
import Foundation
import Testing

@testable import Doma

@MainActor
struct PaprikaImportTests {
  private func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
    try JSONDecoder().decode(type, from: Data(json.utf8))
  }

  private func item(_ uid: String, recipe: String?) throws -> DomaPaprikaImportItem {
    let recipeJSON = recipe.map { "\"\($0)\"" } ?? "null"
    return try decode(DomaPaprikaImportItem.self, #"{"uid":"\#(uid)","title":"\#(uid) line","recipe":\#(recipeJSON)}"#)
  }

  @Test func decodesThePreviewAndItsFailures() throws {
    let preview = try decode(
      DomaPaprikaImportPreview.self, #"{"status":"ok","items":[{"uid":"G1","title":"100g spinach","recipe":"Pie"}]}"#)
    guard case .items(let items) = preview else { Issue.record("expected items"); return }
    #expect(items.map(\.title) == ["100g spinach"])
    #expect(items.map(\.recipe) == ["Pie"])
    #expect(
      try decode(DomaPaprikaImportPreview.self, #"{"status":"rejected","reason":null}"#) == .failed(.rejected(reason: nil)))
    #expect(try decode(DomaPaprikaImportPreview.self, #"{"status":"not_connected"}"#) == .failed(.notConnected))
    let noList = try decode(DomaPaprikaImportPreview.self, #"{"status":"no_groceries_list"}"#)
    #expect(noList == .noGroceriesList)
    #expect(PaprikaImportCopy.previewProblem(noList) == PaprikaImportCopy.noGroceriesList)
  }

  @Test func decodesEachImportOutcome() throws {
    #expect(
      try decode(DomaPaprikaImportResult.self, #"{"status":"imported","count":3,"listName":"Shopping list","removal":"failed"}"#)
        == .imported(count: 3, listName: "Shopping list", removal: .failed))
    #expect(try decode(DomaPaprikaImportResult.self, #"{"status":"no_groceries_list"}"#) == .noGroceriesList)
    #expect(
      try decode(DomaPaprikaImportResult.self, #"{"status":"unavailable","httpStatus":null}"#)
        == .failed(.unavailable(httpStatus: nil)))
  }

  @Test func groupsItemsByRecipeWithLooseItemsLast() throws {
    let groups = PaprikaImportCopy.groups([
      try item("A", recipe: nil), try item("B", recipe: "Pie"), try item("C", recipe: "Soup"), try item("D", recipe: "Pie"),
    ])
    #expect(groups.map(\.title) == ["Pie", "Soup", "Other items"])
    #expect(groups.map { $0.items.map(\.uid) } == [["B", "D"], ["C"], ["A"]])
  }

  @Test func saysWhatAnImportDidAndKeepsTheSheetUpWhenNothingWasAdded() {
    let added = PaprikaImportCopy.outcome(.imported(count: 1, listName: "Shopping list", removal: .removed))
    #expect(added.message == "Added 1 item to Shopping list.")
    #expect(!added.isProblem)

    let stillInPaprika = PaprikaImportCopy.outcome(.imported(count: 2, listName: "Shopping list", removal: .failed))
    #expect(stillInPaprika.message.contains("couldn't be removed from Paprika"))
    #expect(!stillInPaprika.isProblem)

    let nothing = PaprikaImportCopy.outcome(.imported(count: 0, listName: "Shopping list", removal: .kept))
    #expect(nothing.message == PaprikaImportCopy.nothingNew)

    #expect(PaprikaImportCopy.outcome(.noGroceriesList).isProblem)
    let unreachable = PaprikaImportCopy.outcome(.failed(.unavailable(httpStatus: nil)))
    #expect(unreachable.isProblem)
    #expect(unreachable.message.contains("Nothing on your list changed"))
  }

  @Test func marksItemsThatCameFromPaprika() throws {
    let items = try decode(
      [DomaListItem].self,
      #"[{"_id":"i1","title":"Milk","source":"paprika","propertyValues":[]},{"_id":"i2","title":"Bread","propertyValues":[]}]"#)
    #expect(items.map(\.isFromPaprika) == [true, false])
  }
}
