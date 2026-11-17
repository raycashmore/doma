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

  /// "Wed", or `nil` on the same day as `now`.
  public func day(_ date: Date, now: Date) -> String? {
    calendar.isDate(date, inSameDayAs: now) ? nil : format(date, "EEE")
  }

  /// A This week row's lead: "8:00" today, "Wed 8:00" later, and "Today" or "Wed" for an all-day event.
  public func rowLead(_ event: DomaHomeWidgetSummary.Event, now: Date) -> String {
    let day = event.startDate <= now ? nil : day(event.startDate, now: now)
    if event.allDay { return day ?? "Today" }
    return [day, format(event.startDate, "h:mm")].compactMap { $0 }.joined(separator: " ")
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
