import DomaKit
import SwiftUI

/// Moving through every month with data, whatever range the tab shows.
struct SpendingMonthStepper: Equatable {
  /// Oldest first.
  let months: [DomaSpendingMonthNet]
  let current: DomaMonth

  private var index: Int? { months.firstIndex { $0.month == current } }

  var date: Double? { index.map { months[$0].date } }

  var previous: DomaMonth? {
    guard let index, index > 0 else { return nil }
    return months[index - 1].month
  }

  var next: DomaMonth? {
    guard let index, index < months.count - 1 else { return nil }
    return months[index + 1].month
  }
}

/// "▼ 4.1% vs Sep": a section's change against the month with data before. Good news is green;
/// the rest stays quiet, because one month's change is not a trend.
struct SpendingMonthTrend: Equatable {
  let text: String
  let spokenText: String
  let isGood: Bool

  /// `nil` without a trend or an earlier month. `lowerIsBetter` is true for spend.
  init?(_ trend: DomaSpendingMonthDetail.Trend?, before prior: DomaMonth?, lowerIsBetter: Bool = false) {
    guard let trend, let prior else { return nil }
    let name = SpendingFormat.shortMonth(prior)
    let amount = "\(SpendingFormat.oneDecimal(abs(trend.pct)))%"
    switch trend.direction {
    case .up:
      text = "▲ \(amount) vs \(name)"
      spokenText = "Up \(amount) on \(SpendingFormat.longMonth(prior))"
      isGood = !lowerIsBetter
    case .down:
      text = "▼ \(amount) vs \(name)"
      spokenText = "Down \(amount) on \(SpendingFormat.longMonth(prior))"
      isGood = lowerIsBetter
    case .flat:
      text = "Flat vs \(name)"
      spokenText = "No change on \(SpendingFormat.longMonth(prior))"
      isGood = false
    }
  }

  var color: Color { isGood ? DomaColor.warmPositiveText : DomaColor.warmTextSecondary }
}

/// The spend categories the sheet shows: the five largest until Show all, each with its share of
/// the largest for the bar.
struct SpendingCategoryPreview: Equatable {
  static let limit = 5

  /// Largest first, as the server sends them.
  let categories: [DomaSpendingMonthDetail.Category]
  let showsAll: Bool

  var shown: [DomaSpendingMonthDetail.Category] {
    showsAll ? categories : Array(categories.prefix(Self.limit))
  }

  var canExpand: Bool { categories.count > Self.limit }

  /// 0 to 1.
  func share(of category: DomaSpendingMonthDetail.Category) -> Double {
    guard let largest = categories.map(\.amount).max(), largest > 0 else { return 0 }
    return min(max(Double(category.amount) / Double(largest), 0), 1)
  }
}
