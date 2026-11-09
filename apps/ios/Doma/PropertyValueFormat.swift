import DomaKit
import Foundation

enum PropertyValueFormat {
  /// Plain digits with no grouping, so the value reads back as the same number when edited.
  static func number(_ value: Double, locale: Locale = .current) -> String {
    value.formatted(.number.grouping(.never).precision(.fractionLength(0...15)).locale(locale))
  }

  /// Returns `nil` for anything that is not entirely a finite number.
  static func parseNumber(_ text: String, locale: Locale = .current) -> Double? {
    let formatter = NumberFormatter()
    formatter.locale = locale
    formatter.numberStyle = .decimal
    formatter.usesGroupingSeparator = false
    guard let value = formatter.number(from: text)?.doubleValue, value.isFinite else { return nil }
    return value
  }

  /// Dates are stored at local noon, as the web does, so they keep their day across time zones.
  static func noon(of date: Date, calendar: Calendar = .current) -> Date {
    calendar.date(bySettingHour: 12, minute: 0, second: 0, of: date) ?? date
  }

  static func date(_ date: Date, now: Date = .now, calendar: Calendar = .current, locale: Locale = .current) -> String {
    let isThisYear = calendar.isDate(date, equalTo: now, toGranularity: .year)
    let format = Date.FormatStyle(locale: locale, calendar: calendar, timeZone: calendar.timeZone).day().month(.abbreviated)
    return date.formatted(isThisYear ? format : format.year())
  }

  /// A list row's second line, in property order and then the notes. The property the list is
  /// grouped by is left out, because the group's header already shows it.
  static func rowDetails(
    of item: DomaListItem, properties: [DomaListProperty], excluding groupingPropertyId: String? = nil
  ) -> [RowDetail] {
    let values = properties.filter { $0.id != groupingPropertyId }.compactMap { property in
      item.propertyValues.first { $0.propertyId == property.id }.flatMap { value in
        describe(value, of: property).map { RowDetail(text: $0, isDate: property.kind == .date) }
      }
    }
    let note = item.notes?.split(whereSeparator: \.isNewline).first
      .map { $0.trimmingCharacters(in: .whitespaces) }
    guard let note, !note.isEmpty else { return values }
    return values + [RowDetail(text: note, isDate: false)]
  }

  private static func describe(_ value: DomaListItemPropertyValue, of property: DomaListProperty) -> String? {
    switch property.kind {
    case .text: value.textValue
    case .number: value.numberValue.map { number($0) }
    case .date: value.date.map { date($0) }
    case .select: property.options?.first { $0.id == value.selectOptionId }?.label
    // A ticked box reads as its name, such as Urgent; an unticked one says nothing.
    case .checkbox: value.checkboxValue == true ? property.name : nil
    }
  }
}

struct RowDetail: Equatable {
  let text: String
  /// Dates show in the accent colour with a calendar symbol.
  let isDate: Bool
}
