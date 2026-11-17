import Foundation

/// The Home widget's summary, as `packages/convex/convex/home/widgetSummary.ts` returns it.
public struct DomaHomeWidgetSummary: Codable, Equatable, Sendable {
  public let next: Event?
  public let thisWeek: Week
  /// The Groceries list, or `nil` when none is set up.
  public let list: List?
  public let note: Note?

  public init(next: Event?, thisWeek: Week, list: List?, note: Note?) {
    self.next = next
    self.thisWeek = thisWeek
    self.list = list
    self.note = note
  }

  public struct Event: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let title: String
    /// The first line of the event's description.
    public let detail: String?
    /// Milliseconds since 1970.
    public let start: Double
    public let end: Double
    public let allDay: Bool

    public init(id: String, title: String, detail: String? = nil, start: Date, end: Date, allDay: Bool = false) {
      self.id = id
      self.title = title
      self.detail = detail
      self.start = start.timeIntervalSince1970 * 1000
      self.end = end.timeIntervalSince1970 * 1000
      self.allDay = allDay
    }

    public var startDate: Date { Date(timeIntervalSince1970: start / 1000) }
    public var endDate: Date { Date(timeIntervalSince1970: end / 1000) }
  }

  public struct Week: Codable, Equatable, Sendable {
    /// The first few events after `next`, in start order.
    public let events: [Event]

    public init(events: [Event]) {
      self.events = events
    }
  }

  public struct List: Codable, Equatable, Sendable {
    public let publicId: String
    public let name: String
    public let activeCount: Int

    public init(publicId: String, name: String, activeCount: Int) {
      self.publicId = publicId
      self.name = name
      self.activeCount = activeCount
    }
  }

  public struct Note: Codable, Equatable, Sendable {
    public enum Kind: String, Codable, Sendable {
      case manualNote, emailNotice
    }

    public let kind: Kind
    public let id: String
    public let title: String

    public init(kind: Kind, id: String, title: String) {
      self.kind = kind
      self.id = id
      self.title = title
    }

    /// The noticeboard item it is, such as `manualNote:<id>`.
    public var boardItemId: String { "\(kind.rawValue):\(id)" }
  }
}

/// What the Home widget shows at one moment, worked out from a summary fetched earlier. Finished
/// events drop off and the next one moves up, so a timeline of these stays right between fetches.
public struct DomaHomeWidgetBoard: Equatable, Sendable {
  public enum Tile: Equatable, Sendable {
    case next, week, list, note
  }

  public let date: Date
  /// The next timed event today, which may already have started. Later days wait for This week.
  public let next: DomaHomeWidgetSummary.Event?
  /// The events after `next`, in start order.
  public let week: [DomaHomeWidgetSummary.Event]
  /// Hidden when nothing is on it.
  public let list: DomaHomeWidgetSummary.List?
  public let note: DomaHomeWidgetSummary.Note?

  public init(summary: DomaHomeWidgetSummary, at date: Date, calendar: Calendar = .current) {
    self.date = date
    let known = ([summary.next].compactMap { $0 } + summary.thisWeek.events).filter { $0.endDate > date }
    let next = known.first { event in
      !event.allDay && (event.startDate <= date || calendar.isDate(event.startDate, inSameDayAs: date))
    }
    self.next = next
    week = known.filter { $0 != next && (next == nil || $0.start >= next!.start) }
    list = summary.list.flatMap { $0.activeCount > 0 ? $0 : nil }
    note = summary.note
  }

  public var isAllClear: Bool { next == nil && week.isEmpty && list == nil && note == nil }

  /// Medium: Next and List on the left, This week and Note on the right. With nothing booked, the
  /// note and the list stack across the width. The first tile in a column takes the space the
  /// others leave.
  public var mediumColumns: [[Tile]] {
    let columns =
      if next != nil { [present([.next, .list]), present([.week, .note])] }
      else if !week.isEmpty { [present([.week, .list]), present([.note])] }
      else { [present([.note, .list])] }
    return columns.filter { !$0.isEmpty }
  }

  /// Small: Next and one more, the note before the list. With nothing timed, the note and the
  /// list; This week only fills a gap.
  public var smallTiles: [Tile] {
    if next != nil { return [.next] + present([.note, .list]).prefix(1) }
    return Array(present([.note, .list, .week]).prefix(2))
  }

  /// Lock Screen: up to three lines.
  public var lockScreenTiles: [Tile] {
    if next != nil {
      return [.next] + present(week.isEmpty ? [.note, .list] : [.week, .list])
    }
    return present([.note, .week, .list])
  }

  private func present(_ tiles: [Tile]) -> [Tile] {
    tiles.filter { tile in
      switch tile {
      case .next: next != nil
      case .week: !week.isEmpty
      case .list: list != nil
      case .note: note != nil
      }
    }
  }

  /// When the board next changes by itself: each event's start and end, and each midnight, so
  /// finished events leave and "Wed" becomes today.
  public static func changeDates(
    for summary: DomaHomeWidgetSummary, after date: Date, until end: Date, calendar: Calendar
  ) -> [Date] {
    let events = [summary.next].compactMap { $0 } + summary.thisWeek.events
    var dates = Set(events.flatMap { [$0.startDate, $0.endDate] })
    var midnight = calendar.startOfDay(for: date)
    while let following = calendar.date(byAdding: .day, value: 1, to: midnight), following <= end {
      dates.insert(following)
      midnight = following
    }
    return dates.filter { $0 > date && $0 <= end }.sorted()
  }
}
