import DomaKit
import Foundation
import Testing

@testable import Doma

@MainActor
struct ItemEditModelTests {
  private struct SaveFailed: Error {}

  private let properties = try! JSONDecoder().decode(
    [DomaListProperty].self,
    from: Data(
      #"""
      [{"_id":"text","name":"Aisle","type":"text"},
       {"_id":"number","name":"Quantity","type":"number"},
       {"_id":"date","name":"Needed by","type":"date"},
       {"_id":"select","name":"Priority","type":"select","options":[{"id":"high","label":"High"},{"id":"low","label":"Low"}]},
       {"_id":"checkbox","name":"Urgent","type":"checkbox"}]
      """#.utf8))

  private func item(notes: String? = nil, values: String = "") throws -> DomaListItem {
    let notesField = notes.map { #""notes":"\#($0)","# } ?? ""
    return try JSONDecoder().decode(
      DomaListItem.self,
      from: Data(#"{"_id":"item","title":"Apples",\#(notesField)"propertyValues":[\#(values)]}"#.utf8))
  }

  private func model(notes: String? = nil, values: String = "", isCompleted: Bool = false) throws -> ItemEditModel {
    ItemEditModel(item: try item(notes: notes, values: values), properties: properties, isCompleted: isCompleted)
  }

  @Test func openingAnItemChangesNothing() throws {
    let model = try model(
      notes: "Firm ones",
      values: #"""
        {"listPropertyId":"text","textValue":"Produce"},
        {"listPropertyId":"number","numberValue":2.5},
        {"listPropertyId":"date","dateValue":1790000000000},
        {"listPropertyId":"select","selectOptionId":"high"},
        {"listPropertyId":"checkbox","checkboxValue":false}
        """#)

    #expect(model.changes(properties: properties).isEmpty)
    #expect(!model.canSave(properties: properties))
  }

  @Test func onlyEditedFieldsAreWrittenInAFixedOrder() throws {
    let model = try model(values: #"{"listPropertyId":"text","textValue":"Produce"}"#)

    model.draft.isCompleted = true
    model.draft.values["select"]?.optionId = "low"
    model.draft.notes = "  Firm ones  "
    model.draft.title = " Green apples "

    #expect(
      model.changes(properties: properties) == [
        .title("Green apples"),
        .notes("Firm ones"),
        .setValue(propertyId: "select", .select(optionId: "low")),
        .completion(true),
      ])
  }

  @Test func emptyingAFieldClearsItsValue() throws {
    let model = try model(
      values: #"""
        {"listPropertyId":"text","textValue":"Produce"},
        {"listPropertyId":"number","numberValue":2},
        {"listPropertyId":"select","selectOptionId":"high"},
        {"listPropertyId":"checkbox","checkboxValue":true}
        """#)

    model.draft.values["text"]?.text = "   "
    model.draft.values["number"]?.number = ""
    model.draft.values["select"]?.optionId = nil
    model.draft.values["checkbox"]?.isChecked = nil

    #expect(
      model.changes(properties: properties) == [
        .clearValue(propertyId: "text"),
        .clearValue(propertyId: "number"),
        .clearValue(propertyId: "select"),
        .clearValue(propertyId: "checkbox"),
      ])
  }

  @Test func uncheckingIsDifferentFromNotSet() throws {
    let model = try model()

    model.draft.values["checkbox"]?.isChecked = false

    #expect(model.changes(properties: properties) == [.setValue(propertyId: "checkbox", .checkbox(false))])
  }

  @Test func aNumberThatDoesNotParseBlocksSave() throws {
    let model = try model()

    model.draft.values["number"]?.number = "12abc"

    #expect(model.isInvalid(properties[1]))
    #expect(!model.canSave(properties: properties))
  }

  @Test func aBlankTitleBlocksSave() throws {
    let model = try model()

    model.draft.title = "  "

    #expect(!model.canSave(properties: properties))
  }

  @Test func aPropertyRemovedWhileEditingIsLeftOut() throws {
    let model = try model()

    model.draft.values["text"]?.text = "Produce"

    #expect(model.changes(properties: properties.filter { $0.id != "text" }).isEmpty)
  }

  @Test func aSelectValueWithARemovedOptionReadsAsNone() throws {
    let model = try model(values: #"{"listPropertyId":"select","selectOptionId":"gone"}"#)

    #expect(model.draft.values["select"]?.optionId == nil)
    #expect(model.changes(properties: properties).isEmpty)
  }

  @Test func anOptionRemovedWhileEditingIsLeftOutSoOtherFieldsStillSave() throws {
    let model = try model()
    model.draft.values["select"]?.optionId = "low"
    model.draft.notes = "Firm ones"
    let liveProperties = try JSONDecoder().decode(
      [DomaListProperty].self,
      from: Data(#"[{"_id":"select","name":"Priority","type":"select","options":[{"id":"high","label":"High"}]}]"#.utf8))

    #expect(model.changes(properties: liveProperties) == [.notes("Firm ones")])
  }

  @Test func theSameNumberWrittenDifferentlyIsNotAChange() throws {
    let model = try model(values: #"{"listPropertyId":"number","numberValue":2}"#)

    model.draft.values["number"]?.number = "2.0"

    #expect(model.changes(properties: properties).isEmpty)
  }

  @Test func anInvalidNumberStillCountsAsUnsavedAndCannotClearTheValue() async throws {
    let model = try model(values: #"{"listPropertyId":"number","numberValue":2}"#)
    model.draft.values["number"]?.number = "12abc"

    var written: [ItemChange] = []
    try await model.save(properties: properties) { written.append($0) }

    #expect(!model.changes(properties: properties).isEmpty)
    #expect(written.isEmpty)
  }

  @Test func aSecondSaveDuringASaveReportsThatItDidNotRun() async throws {
    let model = try model()
    model.draft.notes = "Firm ones"

    var secondDidRun = true
    let firstDidRun = try await model.save(properties: properties) { _ in
      secondDidRun = try await model.save(properties: properties) { _ in }
    }

    #expect(firstDidRun)
    #expect(!secondDidRun)
  }

  @Test func aRetryAfterAPartialFailureSendsOnlyWhatRemains() async throws {
    let model = try model()
    model.draft.title = "Green apples"
    model.draft.notes = "Firm ones"
    model.draft.isCompleted = true

    var written: [ItemChange] = []
    await #expect(throws: SaveFailed.self) {
      try await model.save(properties: properties) { change in
        if case .notes = change { throw SaveFailed() }
        written.append(change)
      }
    }
    #expect(written == [.title("Green apples")])
    #expect(!model.isSaving)
    #expect(model.changes(properties: properties) == [.notes("Firm ones"), .completion(true)])

    written = []
    try await model.save(properties: properties) { written.append($0) }

    #expect(written == [.notes("Firm ones"), .completion(true)])
    #expect(model.changes(properties: properties).isEmpty)
  }
}

@MainActor
struct PropertyValueFormatTests {
  private let australia = Locale(identifier: "en_AU")
  private let germany = Locale(identifier: "de_DE")

  @Test func numbersReadBackAsTheSameValue() {
    for value in [0, 2, 0.1, 2.5, -3.25, 1_234_567.125, 0.123456789012] {
      let text = PropertyValueFormat.number(value, locale: australia)
      #expect(PropertyValueFormat.parseNumber(text, locale: australia) == value)
    }
  }

  @Test func numbersFollowTheLocaleDecimalSeparator() {
    #expect(PropertyValueFormat.number(2.5, locale: germany) == "2,5")
    #expect(PropertyValueFormat.parseNumber("2,5", locale: germany) == 2.5)
  }

  @Test func textThatIsNotWhollyANumberIsRejected() {
    for text in ["12abc", "abc", "1.2.3", "", "NaN"] {
      #expect(PropertyValueFormat.parseNumber(text, locale: australia) == nil)
    }
  }

  @Test func noonKeepsTheCalendarDay() throws {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = try #require(TimeZone(identifier: "Australia/Sydney"))
    let lateEvening = try #require(calendar.date(from: DateComponents(year: 2026, month: 11, day: 5, hour: 23, minute: 30)))

    let noon = PropertyValueFormat.noon(of: lateEvening, calendar: calendar)

    #expect(calendar.dateComponents([.year, .month, .day, .hour], from: noon)
      == DateComponents(year: 2026, month: 11, day: 5, hour: 12))
  }

  @Test func theYearShowsOnlyWhenItIsNotThisYear() throws {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = try #require(TimeZone(identifier: "Australia/Sydney"))
    let now = try #require(calendar.date(from: DateComponents(year: 2026, month: 11, day: 5)))
    let later = try #require(calendar.date(from: DateComponents(year: 2027, month: 1, day: 2)))

    #expect(!PropertyValueFormat.date(now, now: now, calendar: calendar, locale: australia).contains("2026"))
    #expect(PropertyValueFormat.date(later, now: now, calendar: calendar, locale: australia).contains("2027"))
  }

  @Test func theSummaryFollowsPropertyOrderAndSkipsMissingValues() throws {
    let properties = try JSONDecoder().decode(
      [DomaListProperty].self,
      from: Data(
        #"""
        [{"_id":"a","name":"Aisle","type":"text"},
         {"_id":"b","name":"Priority","type":"select","options":[{"id":"high","label":"High"}]},
         {"_id":"c","name":"Urgent","type":"checkbox"}]
        """#.utf8))
    let item = try JSONDecoder().decode(
      DomaListItem.self,
      from: Data(
        #"""
        {"_id":"i","title":"Apples","propertyValues":[
          {"listPropertyId":"c","checkboxValue":false},
          {"listPropertyId":"a","textValue":"Produce"}]}
        """#.utf8))

    #expect(PropertyValueFormat.summary(of: item, properties: properties) == "Produce · Unchecked")
  }
}
