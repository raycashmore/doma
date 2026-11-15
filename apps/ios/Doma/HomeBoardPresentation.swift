import DomaKit
import Foundation

/// What the noticeboard shows, decided from the server's board: which cards are worth a place,
/// and the words on them. Dates and times use the household's time zone, as on the web.
struct HomeBoardPresentation {
  let board: DomaHomeBoard

  private var timeZone: TimeZone { TimeZone(identifier: board.timeZone) ?? .current }

  /// Today and Meals, when they have something to say.
  var leadCards: [DomaBoardItem] {
    board.items.filter { item in
      switch item {
      case .today(let today): Self.isWorthShowing(today)
      case .meals(let meals): meals.schoolLunch != nil || meals.dinner != nil
      default: false
      }
    }
  }

  /// Notes and notices, in the server's order (most urgent notes first).
  var attentionCards: [DomaBoardItem] {
    board.items.filter { item in
      switch item {
      case .today, .meals: false
      default: true
      }
    }
  }

  var visibleCards: [DomaBoardItem] { leadCards + attentionCards }

  /// A briefing that never ran, or had nothing to say, earns a card only for events later today.
  static func isWorthShowing(_ today: DomaBoardToday) -> Bool {
    today.briefingStatus == .available || !today.laterToday.isEmpty || !today.morning.isEmpty
      || !today.watchouts.isEmpty
  }

  /// "Sunday 15 November".
  var headerDate: String {
    guard let date = date(fromCalendarDay: board.localDate) else { return "" }
    return date.formatted(style.weekday(.wide).day().month(.wide))
  }

  // MARK: Kickers

  func kicker(for item: DomaBoardItem) -> String {
    switch item {
    case .today(let today):
      guard let generatedAt = today.generatedAt else { return "Morning briefing" }
      return "Morning briefing · \(time(generatedAt))"
    case .meals: return "Today's meals"
    case .note(let note): return dueLabel(note.dueState, note.dueDate) ?? "Shared note"
    case .emailNotice(let notice):
      if let state = notice.dueState, let label = dueLabel(state, notice.dueDate) { return label }
      switch notice.priority {
      case .high: return "High priority"
      case .low: return "Quiet notice"
      case .medium: return "Forwarded email"
      }
    case .spendingInsight: return "Spending insight"
    }
  }

  /// Overdue and due-today cards carry the accent; nothing else does.
  func isUrgent(_ item: DomaBoardItem) -> Bool {
    let state: DomaDueState? =
      switch item {
      case .note(let note): note.dueState
      case .emailNotice(let notice): notice.dueState
      default: nil
      }
    return state == .overdue || state == .dueToday
  }

  func dueLabel(_ state: DomaDueState, _ dueDate: String?) -> String? {
    switch state {
    case .none: return nil
    case .dueToday: return "Due today"
    case .overdue: return dueDate.flatMap(shortDate).map { "Overdue · \($0)" } ?? "Overdue"
    case .upcoming: return dueDate.flatMap(shortDate).map { "Due \($0)" } ?? "Due soon"
    }
  }

  // MARK: Titles

  /// "September spending"; the year is added when the insight is from another year.
  func spendingTitle(_ insight: DomaBoardSpendingInsight) -> String {
    guard let month = date(fromCalendarDay: insight.period + "-01") else { return "Spending" }
    let sameYear = insight.period.prefix(4) == board.localDate.prefix(4)
    var format = style.month(.wide)
    if !sameYear { format = format.year() }
    return "\(month.formatted(format)) spending"
  }

  // MARK: Today

  struct TodayLine: Equatable, Identifiable {
    enum Kind { case morning, later, watchout }
    let id: String
    let kind: Kind
    let text: String

    var label: String {
      switch kind {
      case .morning: "Morning"
      case .later: "Afternoon"
      case .watchout: "Watch out"
      }
    }
  }

  /// Morning items, then events later today, then watch-outs, worded as on the web.
  func todayLines(_ today: DomaBoardToday) -> [TodayLine] {
    let morning = today.morning.enumerated().map { index, line in
      TodayLine(id: "morning-\(index)", kind: .morning, text: Self.withWho(line.who, line.text))
    }
    let later = today.laterToday.map { event in
      TodayLine(
        id: "later-\(event.id)", kind: .later,
        text: "\(Self.withWho(event.who, event.title)) · \(event.allDay ? "All day" : time(event.start))")
    }
    let watchouts = today.watchouts.enumerated().map { index, line in
      TodayLine(id: "watchout-\(index)", kind: .watchout, text: line.text)
    }
    return morning + later + watchouts
  }

  /// The card shows this many lines of Today, then says how many more the detail holds.
  static let todayPreviewCount = 2

  // MARK: Detail

  /// "Tue 10 Nov, 8:12 am".
  func receivedAt(_ notice: DomaBoardEmailNotice) -> String {
    Date(timeIntervalSince1970: notice.occurredAt / 1000).formatted(
      style.weekday(.abbreviated).day().month(.abbreviated).hour().minute())
  }

  /// "Friday 13 November", for a `YYYY-MM-DD` day.
  func longDate(_ day: String) -> String? {
    date(fromCalendarDay: day).map {
      $0.formatted(style.weekday(.wide).day().month(.wide))
    }
  }

  // MARK: Helpers

  /// Doma's household writes dates the Australian way: "Fri 13 Nov".
  private static let locale = Locale(identifier: "en_AU")

  /// The household's locale and zone; fields are added by each caller.
  private var style: Date.FormatStyle { Date.FormatStyle(locale: Self.locale, timeZone: timeZone) }

  private static func withWho(_ who: [String], _ text: String) -> String {
    who.isEmpty ? text : "\(who.joined(separator: ", ")) — \(text)"
  }

  /// "Fri 13 Nov", without the comma the locale's format adds.
  private func shortDate(_ day: String) -> String? {
    guard let date = date(fromCalendarDay: day) else { return nil }
    let formatter = DateFormatter()
    formatter.locale = Self.locale
    formatter.timeZone = timeZone
    formatter.dateFormat = "EEE d MMM"
    return formatter.string(from: date)
  }

  private func time(_ milliseconds: Double) -> String {
    Date(timeIntervalSince1970: milliseconds / 1000).formatted(style.hour().minute())
  }

  /// Noon on that day in the household's zone, so no zone shift moves it to another day.
  private func date(fromCalendarDay day: String) -> Date? {
    let parts = day.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3 else { return nil }
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12))
  }
}
