import DomaKit
import Foundation

/// Text for Spending. The server does the maths; this only formats cents, basis points and months,
/// in Australian English to match the web.
enum SpendingFormat {
  private static let locale = Locale(identifier: "en_AU")
  private static let utc = TimeZone(identifier: "UTC")!

  /// Whole dollars: "$1,840", "-$500".
  static func money(_ cents: Int) -> String {
    let dollars = (Double(cents) / 100).rounded()
    let digits = abs(dollars).formatted(.number.precision(.fractionLength(0)).locale(locale))
    return dollars < 0 ? "-$\(digits)" : "$\(digits)"
  }

  /// A net with its sign: "+$2,100", "-$500", "$0".
  static func signedMoney(_ cents: Int) -> String {
    (Double(cents) / 100).rounded() > 0 ? "+\(money(cents))" : money(cents)
  }

  /// Basis points as a percentage: 1950 is "19.5%".
  static func percent(basisPoints: Int) -> String {
    "\(oneDecimal(Double(basisPoints) / 100))%"
  }

  static func shortMonth(_ month: DomaMonth) -> String { symbols(\.shortMonthSymbols)[month.month - 1] }
  static func longMonth(_ month: DomaMonth) -> String { symbols(\.monthSymbols)[month.month - 1] }
  /// "February 2026", without the grouping separator a localised year would get.
  static func longMonthYear(_ month: DomaMonth) -> String { "\(longMonth(month)) \(month.year)" }

  /// "Oct 2026", "May – Oct 2026", or "Nov 2025 – Apr 2026" across years.
  static func rangeTitle(_ range: DomaMonthRange) -> String {
    if range.from == range.to { return "\(shortMonth(range.to)) \(range.to.year)" }
    if range.from.year == range.to.year {
      return "\(shortMonth(range.from)) – \(shortMonth(range.to)) \(range.to.year)"
    }
    return "\(shortMonth(range.from)) \(range.from.year) – \(shortMonth(range.to)) \(range.to.year)"
  }

  /// "6 mo".
  static func monthCount(_ count: Int) -> String { "\(count) mo" }

  /// "6 months", "1 month".
  static func monthCountLong(_ count: Int) -> String { count == 1 ? "1 month" : "\(count) months" }

  /// The header's "Updated 31 October", from the latest budget row's month-end date (UTC, as the
  /// server reads it).
  static func updated(_ date: Double) -> String {
    let style = Date.FormatStyle(date: .omitted, time: .omitted, locale: locale, timeZone: utc)
      .day().month(.wide)
    return "Updated \(Date(timeIntervalSince1970: date / 1000).formatted(style))"
  }

  /// A chart axis value in dollars: "0", "500", "5k", "12k", "2.5k".
  static func axisAmount(_ dollars: Double) -> String {
    guard abs(dollars) >= 1000 else { return dollars.formatted(.number.precision(.fractionLength(0)).locale(locale)) }
    let thousands = dollars / 1000
    let digits = thousands.formatted(.number.precision(.fractionLength(0...1)).locale(locale))
    return "\(digits)k"
  }

  static func oneDecimal(_ value: Double) -> String {
    value.formatted(.number.precision(.fractionLength(1)).locale(locale))
  }

  private static func symbols(_ keyPath: KeyPath<DateFormatter, [String]>) -> [String] {
    let formatter = DateFormatter()
    formatter.locale = locale
    return formatter[keyPath: keyPath]
  }
}

/// A change against the comparison months, as the overview card shows it.
struct SpendingChange: Equatable {
  enum Direction: Equatable { case up, down, flat }
  /// Whether the change is good news: a fall in spend is, a fall in income is not.
  enum Tone: Equatable { case good, bad, neutral }
  enum Kind { case money, percent, points }

  let direction: Direction
  let tone: Tone
  /// "$320", "2.1%" or "1.8 pp", without the arrow.
  let amount: String

  /// `nil` without a comparison. `lowerIsBetter` is true for spend.
  init?(_ metric: DomaSpending.Metric, kind: Kind, lowerIsBetter: Bool = false) {
    guard let delta = metric.delta else { return nil }
    // The direction follows the shown amount, so a change that rounds to nothing reads as none.
    let shown: Double
    switch (kind, metric.deltaPct) {
    case (.percent, let percent?):
      shown = (percent * 10).rounded() / 10
      amount = "\(SpendingFormat.oneDecimal(abs(shown)))%"
    case (.points, _):
      shown = (Double(delta) / 10).rounded() / 10
      amount = "\(SpendingFormat.oneDecimal(abs(shown))) pp"
    default:
      // Money, or a percentage against an earlier 0, where the amount stands in.
      shown = (Double(delta) / 100).rounded()
      amount = SpendingFormat.money(abs(delta))
    }
    direction = shown > 0 ? .up : shown < 0 ? .down : .flat
    switch direction {
    case .flat: tone = .neutral
    case .up: tone = lowerIsBetter ? .bad : .good
    case .down: tone = lowerIsBetter ? .good : .bad
    }
  }

  /// "▲ 2.1%".
  var text: String {
    switch direction {
    case .up: "▲ \(amount)"
    case .down: "▼ \(amount)"
    case .flat: "No change"
    }
  }

  /// "Up 2.1%", for VoiceOver, which reads the arrows as shapes.
  var spokenText: String {
    switch direction {
    case .up: "Up \(amount)"
    case .down: "Down \(amount)"
    case .flat: "No change"
    }
  }
}
