import DomaKit
import Foundation
import Testing

struct HomeWidgetBoardTests {
  private static let calendar: Calendar = {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Australia/Sydney")!
    return calendar
  }()

  /// Tuesday 17 November 2026, 5:40 pm in Sydney.
  private static let now = calendar.date(from: DateComponents(year: 2026, month: 11, day: 17, hour: 17, minute: 40))!

  private static func at(day: Int, hour: Int, minute: Int = 0) -> Date {
    calendar.date(from: DateComponents(year: 2026, month: 11, day: day, hour: hour, minute: minute))!
  }

  private static func event(_ title: String, day: Int = 17, hour: Int, allDay: Bool = false) -> DomaHomeWidgetSummary.Event {
    let start = at(day: day, hour: hour)
    return .init(id: title, title: title, start: start, end: start.addingTimeInterval(60 * 60), allDay: allDay)
  }

  private static let pickUp = event("Pick up", hour: 19)
  private static let bins = event("Bins out", hour: 20)
  private static let swimming = event("Swimming", day: 18, hour: 8)
  private static let shopping = DomaHomeWidgetSummary.List(publicId: "list", name: "Shopping", activeCount: 8)
  private static let note = DomaHomeWidgetSummary.Note(kind: .manualNote, id: "n1", title: "Plumber Thursday")

  private static func summary(
    events: [DomaHomeWidgetSummary.Event] = [pickUp, bins, swimming],
    list: DomaHomeWidgetSummary.List? = shopping,
    note: DomaHomeWidgetSummary.Note? = note
  ) -> DomaHomeWidgetSummary {
    .init(thisWeek: .init(events: events), list: list, note: note)
  }

  @Test func aBusyWeekShowsEveryTileInTheBoardLayout() {
    let board = DomaHomeWidgetBoard(summary: Self.summary(), at: Self.now, calendar: Self.calendar)

    #expect(board.mediumColumns == [[.next, .list], [.week, .note]])
    #expect(board.smallTiles == [.next, .note])
    #expect(board.lockScreenTiles == [.next, .week, .list])
  }

  @Test func tilesWithNothingToSayHide() {
    let board = DomaHomeWidgetBoard(
      summary: Self.summary(events: [Self.pickUp], list: .init(publicId: "list", name: "Shopping", activeCount: 0), note: nil),
      at: Self.now)

    #expect(board.mediumColumns == [[.next]])
    #expect(board.smallTiles == [.next])
  }

  @Test func withNothingBookedTheNoteAndListTakeTheSpace() {
    let board = DomaHomeWidgetBoard(summary: Self.summary(events: []), at: Self.now, calendar: Self.calendar)

    #expect(board.mediumColumns == [[.note, .list]])
    #expect(board.smallTiles == [.note, .list])
    #expect(board.lockScreenTiles == [.note, .list])
    #expect(!board.isAllClear)
  }

  @Test func nothingBookedListedOrPinnedIsAllClear() {
    let board = DomaHomeWidgetBoard(summary: Self.summary(events: [], list: nil, note: nil), at: Self.now, calendar: Self.calendar)

    #expect(board.isAllClear)
  }

  @Test func aFinishedEventDropsOffAndTheNextMovesUp() {
    let summary = Self.summary()

    let duringPickUp = DomaHomeWidgetBoard(summary: summary, at: Self.at(day: 17, hour: 19, minute: 30), calendar: Self.calendar)
    #expect(duringPickUp.next == Self.pickUp)

    let afterPickUp = DomaHomeWidgetBoard(summary: summary, at: Self.at(day: 17, hour: 20), calendar: Self.calendar)
    #expect(afterPickUp.next == Self.bins)
    #expect(afterPickUp.week == [Self.swimming])
  }

  @Test func nextIsOnlyToday() {
    let board = DomaHomeWidgetBoard(
      summary: Self.summary(events: [Self.swimming]), at: Self.now, calendar: Self.calendar)

    #expect(board.next == nil)
    #expect(board.week == [Self.swimming])

    let nextMorning = DomaHomeWidgetBoard(
      summary: Self.summary(events: [Self.swimming]), at: Self.at(day: 18, hour: 6), calendar: Self.calendar)
    #expect(nextMorning.next == Self.swimming)
  }

  @Test func anEventBecomesNextTwoHoursBeforeItStarts() {
    let summary = Self.summary(events: [Self.pickUp])

    let early = DomaHomeWidgetBoard(summary: summary, at: Self.at(day: 17, hour: 16, minute: 59), calendar: Self.calendar)
    #expect(early.next == nil)
    #expect(early.week == [Self.pickUp])

    let due = DomaHomeWidgetBoard(summary: summary, at: Self.at(day: 17, hour: 17), calendar: Self.calendar)
    #expect(due.next == Self.pickUp)
    #expect(due.week.isEmpty)
  }

  private static func requirement(_ title: String, hour: Int = 8, minute: Int = 0) -> DomaHomeWidgetSummary.Event {
    let start = at(day: 18, hour: hour, minute: minute)
    return .init(id: title, title: title, start: start, end: start.addingTimeInterval(60 * 60))
  }

  @Test func overlappingRequirementsShareNextWithOneRowPerPerson() {
    let dropOff = Self.event("Drop-off", day: 18, hour: 8)
    let summary = DomaHomeWidgetSummary(
      thisWeek: .init(events: [dropOff]),
      requirements: [
        Self.requirement("Sam: Sport day"), Self.requirement("Alex: Library bag"),
        Self.requirement("Sam: Hat", minute: 30), Self.requirement("Return form"), Self.requirement("Sam: Recorder", hour: 9),
      ],
      list: nil, note: nil)

    let board = DomaHomeWidgetBoard(summary: summary, at: Self.at(day: 18, hour: 7, minute: 20), calendar: Self.calendar)

    #expect(board.next?.title == "Sam: Sport day")
    #expect(board.requirementRows == [
      .init(who: "Sam", what: "Sport day · Hat"), .init(who: "Alex", what: "Library bag"), .init(who: nil, what: "Return form"),
    ])
    // Ordinary events are never folded in, and requirements never reach This week.
    #expect(board.week == [dropOff])
  }

  @Test func requirementsWaitForTheLeadTimeAndAnEarlierEventGoesFirst() {
    let breakfast = Self.event("Breakfast", day: 18, hour: 7)
    let summary = DomaHomeWidgetSummary(
      thisWeek: .init(events: [breakfast]), requirements: [Self.requirement("Sam: Sport day")], list: nil, note: nil)

    let early = DomaHomeWidgetBoard(summary: summary, at: Self.at(day: 18, hour: 4, minute: 59), calendar: Self.calendar)
    #expect(early.next == nil)
    #expect(early.week == [breakfast])

    let atBreakfast = DomaHomeWidgetBoard(summary: summary, at: Self.at(day: 18, hour: 6, minute: 30), calendar: Self.calendar)
    #expect(atBreakfast.next == breakfast)
    #expect(atBreakfast.requirementRows.isEmpty)

    let afterBreakfast = DomaHomeWidgetBoard(summary: summary, at: Self.at(day: 18, hour: 8, minute: 10), calendar: Self.calendar)
    #expect(afterBreakfast.next?.title == "Sam: Sport day")
    #expect(afterBreakfast.requirementRows == [.init(who: "Sam", what: "Sport day")])
  }

  @Test func anEventUnderWayGivesWayToRequirements() {
    let schoolRun = Self.event("School run", day: 18, hour: 7)
    let summary = DomaHomeWidgetSummary(
      thisWeek: .init(events: [schoolRun]), requirements: [Self.requirement("Sam: Sport day", minute: 30)],
      list: nil, note: nil)

    let board = DomaHomeWidgetBoard(summary: summary, at: Self.at(day: 18, hour: 7, minute: 10), calendar: Self.calendar)

    #expect(board.next?.title == "Sam: Sport day")
  }

  @Test func todaysAllDayEventStaysInThisWeekUntilNextIsDue() {
    let holiday = DomaHomeWidgetSummary.Event(
      id: "Holiday", title: "Holiday", start: Self.at(day: 17, hour: 0), end: Self.at(day: 18, hour: 0), allDay: true)
    let board = DomaHomeWidgetBoard(summary: Self.summary(events: [holiday, Self.pickUp]), at: Self.at(day: 17, hour: 9), calendar: Self.calendar)

    #expect(board.next == nil)
    #expect(board.week == [holiday, Self.pickUp])
  }

  @Test func aSummaryFromBeforeRequirementsStillDecodesWithItsNextInTheWeek() throws {
    let encoder = JSONEncoder()
    let next = String(decoding: try encoder.encode(Self.pickUp), as: UTF8.self)
    let later = String(decoding: try encoder.encode(Self.bins), as: UTF8.self)
    let json = Data(#"{"next":\#(next),"thisWeek":{"events":[\#(later)],"total":1},"list":null,"note":null}"#.utf8)

    let summary = try JSONDecoder().decode(DomaHomeWidgetSummary.self, from: json)

    #expect(summary.requirements.isEmpty)
    #expect(summary.thisWeek.events == [Self.pickUp, Self.bins])
  }

  @Test func anAllDayEventNeverLeadsAsNext() {
    let holiday = Self.event("Holiday", day: 18, hour: 0, allDay: true)
    let board = DomaHomeWidgetBoard(summary: Self.summary(events: [holiday]), at: Self.now, calendar: Self.calendar)

    #expect(board.next == nil)
    #expect(board.week == [holiday])
    // Two columns, so the week, note and list don't stack into one short column.
    #expect(board.mediumColumns == [[.week, .list], [.note]])
    #expect(board.smallTiles == [.note, .list])
  }

  @Test func theTimelineChangesAtEachLeadTimeStartEndAndMidnight() {
    let summary = DomaHomeWidgetSummary(
      thisWeek: .init(events: [Self.pickUp, Self.bins]), requirements: [Self.requirement("Sam: Hat", hour: 0)], list: nil, note: nil)
    let dates = DomaHomeWidgetBoard.changeDates(
      for: summary, after: Self.now, until: Self.now.addingTimeInterval(24 * 60 * 60), calendar: Self.calendar)

    // Pick up's lead time, 5 pm, has passed; Bins out's is 6 pm and the midnight requirement's 10 pm.
    #expect(dates == [
      Self.at(day: 17, hour: 18), Self.at(day: 17, hour: 19), Self.at(day: 17, hour: 20), Self.at(day: 17, hour: 21),
      Self.at(day: 17, hour: 22), Self.at(day: 18, hour: 0), Self.at(day: 18, hour: 1),
    ])
  }

  @Test func aRowLeadsWithTheTimeTodayAndTheDayLater() {
    let format = DomaHomeWidgetFormat(calendar: Self.calendar, locale: Locale(identifier: "en_AU"))

    #expect(format.rowLead(Self.bins, now: Self.now) == "8:00")
    #expect(format.rowLead(Self.swimming, now: Self.now) == "Wed")
    // At midnight Wednesday is today.
    #expect(format.rowLead(Self.swimming, now: Self.at(day: 18, hour: 0)) == "8:00")
    #expect(format.rowLead(Self.event("Holiday", day: 18, hour: 0, allDay: true), now: Self.now) == "Wed")
    #expect(format.clock(Self.pickUp.startDate) == ("7:00", "pm"))
  }
}

struct DomaHomeLinkTests {
  @Test func roundTripsHomeAndOneCard() throws {
    #expect(DomaHomeLink(url: try #require(DomaHomeLink.board.url)) == .board)
    let card = try #require(DomaHomeLink.item("manualNote:abc123").url)
    #expect(DomaHomeLink(url: card) == .item("manualNote:abc123"))
  }

  @Test func ignoresOtherLinks() throws {
    #expect(DomaHomeLink(url: try #require(URL(string: "com.doma.app://lists/abc"))) == nil)
    #expect(DomaHomeLink(url: try #require(URL(string: "com.doma.app://home/a/b"))) == nil)
  }
}
