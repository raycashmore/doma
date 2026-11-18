import Foundation

/// The Home widget's summary, as `packages/convex/convex/home/widgetSummary.ts` returns it.
public struct DomaHomeWidgetSummary: Codable, Equatable, Sendable {
  public let next: Event?
  public let thisWeek: Week
  /// Timed events from the Daily requirements calendar over the next two days, in start order.
  /// They only ever show as today's Next.
  public let requirements: [Event]
  /// The Groceries list, or `nil` when none is set up.
  public let list: List?
  public let note: Note?

  public init(next: Event?, thisWeek: Week, requirements: [Event] = [], list: List?, note: Note?) {
    self.next = next
    self.thisWeek = thisWeek
    self.requirements = requirements
    self.list = list
    self.note = note
  }

  /// A server or cached summary from before daily requirements has none.
  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    next = try container.decodeIfPresent(Event.self, forKey: .next)
    thisWeek = try container.decode(Week.self, forKey: .thisWeek)
    requirements = try container.decodeIfPresent([Event].self, forKey: .requirements) ?? []
    list = try container.decodeIfPresent(List.self, forKey: .list)
    note = try container.decodeIfPresent(Note.self, forKey: .note)
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

  /// How long before an event starts it becomes Next. Until then This week holds it.
  public static let leadTime: TimeInterval = 2 * 60 * 60

  public let date: Date
  /// Today's next timed event, once it is within `leadTime` of starting or has started. When
  /// daily requirements come first, the first of them, and `requirementRows` lists the group.
  public let next: DomaHomeWidgetSummary.Event?
  /// When Next is daily requirements: those that overlap the first, one row per person.
  /// Empty when Next is an ordinary event.
  public let requirementRows: [RequirementRow]
  /// The events after `next`, in start order.
  public let week: [DomaHomeWidgetSummary.Event]
  /// Hidden when nothing is on it.
  public let list: DomaHomeWidgetSummary.List?
  public let note: DomaHomeWidgetSummary.Note?

  public init(summary: DomaHomeWidgetSummary, at date: Date, calendar: Calendar = .current) {
    self.date = date
    // The summary's Next can start after today's all-day events, which This week then leads with.
    let known = ([summary.next].compactMap { $0 } + summary.thisWeek.events)
      .filter { $0.endDate > date }
      .sorted { $0.start < $1.start }
    let isDue = { (event: DomaHomeWidgetSummary.Event) in
      !event.allDay && event.endDate > date && event.startDate <= date + Self.leadTime
        && (event.startDate <= date || calendar.isDate(event.startDate, inSameDayAs: date))
    }
    let nextEvent = known.first(where: isDue)
    let firstRequirement = summary.requirements.first(where: isDue)
    let next: DomaHomeWidgetSummary.Event?
    // Requirements go first unless an event starts before them; one already under way gives way.
    if let firstRequirement, nextEvent.map({ firstRequirement.start <= $0.start || $0.startDate <= date }) ?? true {
      next = firstRequirement
      requirementRows = RequirementRow.rows(
        for: summary.requirements.filter { requirement in
          requirement == firstRequirement
            || (requirement.endDate > date && requirement.start < firstRequirement.end && requirement.end > firstRequirement.start)
        })
    } else {
      next = nextEvent
      requirementRows = []
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

  /// When the board next changes by itself: each event's start and end, when it comes within
  /// `leadTime`, and each midnight, so events become Next in time, finished ones leave and "Wed"
  /// becomes today.
  public static func changeDates(
    for summary: DomaHomeWidgetSummary, after date: Date, until end: Date, calendar: Calendar
  ) -> [Date] {
    let events = [summary.next].compactMap { $0 } + summary.thisWeek.events + summary.requirements
    var dates = Set(events.flatMap { [$0.startDate - leadTime, $0.startDate, $0.endDate] })
    var midnight = calendar.startOfDay(for: date)
    while let following = calendar.date(byAdding: .day, value: 1, to: midnight), following <= end {
      dates.insert(following)
      midnight = following
    }
    return dates.filter { $0 > date && $0 <= end }.sorted()
  }
}

extension DomaHomeWidgetBoard {
  /// One person's daily requirements, from titles such as "Sam: Sport day".
  public struct RequirementRow: Equatable, Sendable {
    /// The name before the colon, or `nil` when the title has none.
    public let who: String?
    /// What they need, joined with " · " when they need several things.
    public let what: String

    public init(who: String?, what: String) {
      self.who = who
      self.what = what
    }

    /// One row per person, in the order they first appear.
    static func rows(for requirements: [DomaHomeWidgetSummary.Event]) -> [RequirementRow] {
      var order: [String?] = []
      var things: [String?: [String]] = [:]
      for requirement in requirements {
        let (who, what) = parse(requirement.title)
        if things[who] == nil { order.append(who) }
        things[who, default: []].append(what)
      }
      return order.map { RequirementRow(who: $0, what: things[$0]!.joined(separator: " · ")) }
    }

    private static func parse(_ title: String) -> (who: String?, what: String) {
      guard let colon = title.firstIndex(of: ":") else { return (nil, title) }
      let who = title[..<colon].trimmingCharacters(in: .whitespaces)
      let what = title[title.index(after: colon)...].trimmingCharacters(in: .whitespaces)
      return who.isEmpty || what.isEmpty ? (nil, title) : (who, what)
    }
  }
}
