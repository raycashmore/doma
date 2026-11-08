import DomaKit
import Foundation
import Testing

@testable import Doma

/// The cases of `apps/lists/src/lib/lists/grouping.test.ts`, so the two cannot drift.
/// Items are given in manual order, as the server sends them.
@MainActor
struct ListItemGroupingTests {
  @Test func usesSelectOptionOrderKeepsManualOrderAndPutsUnassignedLast() throws {
    let property = try decodeProperty(
      #"{"_id":"section","name":"Store section","type":"select","options":[{"id":"produce","label":"Produce"},{"id":"bakery","label":"Bakery"},{"id":"household","label":"Household"}]}"#)
    let items = try decodeItems([
      ("Milk", #"{"listPropertyId":"section","selectOptionId":"bakery"}"#),
      ("Carrots", #"{"listPropertyId":"section","selectOptionId":"produce"}"#),
      ("Bananas", #"{"listPropertyId":"section","selectOptionId":"produce"}"#),
      ("Batteries", nil),
    ])

    #expect(
      summary(ListItemGrouping.groups(of: items, by: property)) == [
        "Produce: Carrots, Bananas", "Bakery: Milk", "Unassigned: Batteries",
      ])
  }

  @Test func treatsAValueForARemovedOptionAsUnassigned() throws {
    let property = try decodeProperty(
      #"{"_id":"section","name":"Section","type":"select","options":[{"id":"produce","label":"Produce"}]}"#)
    let items = try decodeItems([("Milk", #"{"listPropertyId":"section","selectOptionId":"gone"}"#)])

    #expect(summary(ListItemGrouping.groups(of: items, by: property)) == ["Unassigned: Milk"])
  }

  @Test func normalizesTextValuesIntoAlphabeticGroupsWithoutChangingItemOrder() throws {
    let property = try decodeProperty(#"{"_id":"area","name":"Area","type":"text"}"#)
    let items = try decodeItems([
      ("Tea", #"{"listPropertyId":"area","textValue":"Pantry"}"#),
      ("Milk", #"{"listPropertyId":"area","textValue":"dairy"}"#),
      ("Yoghurt", #"{"listPropertyId":"area","textValue":" Dairy "}"#),
      ("Batteries", nil),
    ])

    #expect(
      summary(ListItemGrouping.groups(of: items, by: property)) == [
        "dairy: Milk, Yoghurt", "Pantry: Tea", "Unassigned: Batteries",
      ])
  }

  @Test func sortsNumberGroupsByValueAndKeepsMissingValuesUnassigned() throws {
    let property = try decodeProperty(#"{"_id":"quantity","name":"Quantity","type":"number"}"#)
    let items = try decodeItems([
      ("Bananas", #"{"listPropertyId":"quantity","numberValue":2}"#),
      ("Apples", #"{"listPropertyId":"quantity","numberValue":1}"#),
      ("Bread", nil),
    ])

    #expect(
      summary(ListItemGrouping.groups(of: items, by: property)) == ["1: Apples", "2: Bananas", "Unassigned: Bread"])
  }

  @Test func groupsDatesByLocalCalendarDayInChronologicalOrder() throws {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Australia/Sydney")!
    let early = calendar.date(from: DateComponents(year: 2026, month: 7, day: 11, hour: 12))!
    let earlyEvening = calendar.date(from: DateComponents(year: 2026, month: 7, day: 11, hour: 23))!
    let late = calendar.date(from: DateComponents(year: 2026, month: 7, day: 12, hour: 12))!
    let property = try decodeProperty(#"{"_id":"due","name":"Needed by","type":"date"}"#)
    let items = try decodeItems([
      ("Later item", #"{"listPropertyId":"due","dateValue":\#(late.timeIntervalSince1970 * 1000)}"#),
      ("Early item", #"{"listPropertyId":"due","dateValue":\#(early.timeIntervalSince1970 * 1000)}"#),
      ("Same-day item", #"{"listPropertyId":"due","dateValue":\#(earlyEvening.timeIntervalSince1970 * 1000)}"#),
      ("No date", nil),
    ])

    let groups = ListItemGrouping.groups(of: items, by: property, calendar: calendar)

    #expect(groups.map(\.id) == ["date:2026-07-11", "date:2026-07-12", "unassigned"])
    #expect(groups[0].label == PropertyValueFormat.date(early, calendar: calendar))
    #expect(groups.map { $0.items.map(\.title) } == [["Early item", "Same-day item"], ["Later item"], ["No date"]])
  }

  @Test func keepsExplicitCheckboxValuesSeparateFromUnassignedItems() throws {
    let property = try decodeProperty(#"{"_id":"urgent","name":"Urgent","type":"checkbox"}"#)
    let items = try decodeItems([
      ("Ordinary", #"{"listPropertyId":"urgent","checkboxValue":false}"#),
      ("Urgent", #"{"listPropertyId":"urgent","checkboxValue":true}"#),
      ("Unknown", nil),
    ])

    #expect(
      summary(ListItemGrouping.groups(of: items, by: property)) == [
        "Yes: Urgent", "No: Ordinary", "Unassigned: Unknown",
      ])
  }

  private func summary(_ groups: [ListItemGroup]) -> [String] {
    groups.map { "\($0.label): \($0.items.map(\.title).joined(separator: ", "))" }
  }

  private func decodeProperty(_ json: String) throws -> DomaListProperty {
    try JSONDecoder().decode(DomaListProperty.self, from: Data(json.utf8))
  }

  private func decodeItems(_ items: [(title: String, value: String?)]) throws -> [DomaListItem] {
    let rows = items.enumerated().map { index, item in
      #"{"_id":"item-\#(index)","title":"\#(item.title)","propertyValues":[\#(item.value ?? "")]}"#
    }
    return try JSONDecoder().decode([DomaListItem].self, from: Data("[\(rows.joined(separator: ","))]".utf8))
  }
}
