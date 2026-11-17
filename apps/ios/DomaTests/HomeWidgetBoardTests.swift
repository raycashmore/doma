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
    next: DomaHomeWidgetSummary.Event? = pickUp,
    week: [DomaHomeWidgetSummary.Event] = [bins, swimming],
    list: DomaHomeWidgetSummary.List? = shopping,
    note: DomaHomeWidgetSummary.Note? = note
  ) -> DomaHomeWidgetSummary {
    .init(next: next, thisWeek: .init(events: week), list: list, note: note)
  }

  @Test func aBusyWeekShowsEveryTileInTheBoardLayout() {
    let board = DomaHomeWidgetBoard(summary: Self.summary(), at: Self.now, calendar: Self.calendar)

    #expect(board.mediumColumns == [[.next, .list], [.week, .note]])
    #expect(board.smallTiles == [.next, .note])
    #expect(board.lockScreenTiles == [.next, .week, .list])
  }

  @Test func tilesWithNothingToSayHide() {
    let board = DomaHomeWidgetBoard(
      summary: Self.summary(week: [], list: .init(publicId: "list", name: "Shopping", activeCount: 0), note: nil),
      at: Self.now)

    #expect(board.mediumColumns == [[.next]])
    #expect(board.smallTiles == [.next])
  }

  @Test func withNothingBookedTheNoteAndListTakeTheSpace() {
    let board = DomaHomeWidgetBoard(summary: Self.summary(next: nil, week: []), at: Self.now, calendar: Self.calendar)

    #expect(board.mediumColumns == [[.note, .list]])
    #expect(board.smallTiles == [.note, .list])
    #expect(board.lockScreenTiles == [.note, .list])
    #expect(!board.isAllClear)
  }

  @Test func nothingBookedListedOrPinnedIsAllClear() {
    let board = DomaHomeWidgetBoard(summary: Self.summary(next: nil, week: [], list: nil, note: nil), at: Self.now, calendar: Self.calendar)

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
      summary: Self.summary(next: Self.swimming, week: []), at: Self.now, calendar: Self.calendar)

    #expect(board.next == nil)
    #expect(board.week == [Self.swimming])

    let atMidnight = DomaHomeWidgetBoard(
      summary: Self.summary(next: Self.swimming, week: []), at: Self.at(day: 18, hour: 0), calendar: Self.calendar)
    #expect(atMidnight.next == Self.swimming)
  }

  @Test func anAllDayEventNeverLeadsAsNext() {
    let holiday = Self.event("Holiday", day: 18, hour: 0, allDay: true)
    let board = DomaHomeWidgetBoard(summary: Self.summary(next: nil, week: [holiday]), at: Self.now, calendar: Self.calendar)

    #expect(board.next == nil)
    #expect(board.week == [holiday])
    // Two columns, so the week, note and list don't stack into one short column.
    #expect(board.mediumColumns == [[.week, .list], [.note]])
    #expect(board.smallTiles == [.note, .list])
  }

  @Test func theTimelineChangesAtEachStartEndAndMidnight() {
    let summary = Self.summary(week: [Self.bins])
    let dates = DomaHomeWidgetBoard.changeDates(
      for: summary, after: Self.now, until: Self.now.addingTimeInterval(24 * 60 * 60), calendar: Self.calendar)

    #expect(dates == [
      Self.at(day: 17, hour: 19), Self.at(day: 17, hour: 20), Self.at(day: 17, hour: 21), Self.at(day: 18, hour: 0),
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
