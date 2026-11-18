import Foundation

/// The Home widget's dates: the clock time leads, and a day name shows only when it isn't today.
public struct DomaHomeWidgetFormat: Sendable {
  private let calendar: Calendar
  private let locale: Locale

  public init(calendar: Calendar = .current, locale: Locale = .current) {
    self.calendar = calendar
    self.locale = locale
  }

  /// "7:00" and "pm", which Next sets in two sizes.
  public func clock(_ date: Date) -> (time: String, period: String) {
    (format(date, "h:mm"), format(date, "a").lowercased())
  }

  /// Next's time: when it starts, or once it is under way, "until" when it ends, with the day
  /// when that isn't today.
  public func nextClock(start: Date, end: Date, now: Date) -> (lead: String?, time: String, period: String) {
    guard start <= now else {
      let (time, period) = clock(start)
      return (nil, time, period)
    }
    let (time, period) = clock(end)
    return (["until", day(end, now: now)].compactMap(\.self).joined(separator: " "), time, period)
  }

  /// "Wed", or `nil` on the same day as `now`.
  public func day(_ date: Date, now: Date) -> String? {
    calendar.isDate(date, inSameDayAs: now) ? nil : format(date, "EEE")
  }

  /// A This week row's lead, kept short so the title has the room: "8:00" today, "Wed" on a later
  /// day, and "Today" for an all-day event today.
  public func rowLead(_ event: DomaHomeWidgetSummary.Event, now: Date) -> String {
    if event.startDate > now, let day = day(event.startDate, now: now) { return day }
    return event.allDay ? "Today" : format(event.startDate, "h:mm")
  }

  private func format(_ date: Date, _ template: String) -> String {
    let formatter = DateFormatter()
    formatter.calendar = calendar
    formatter.timeZone = calendar.timeZone
    formatter.locale = locale
    formatter.dateFormat = template
    return formatter.string(from: date)
  }
}
