import DomaKit
import SwiftUI

/// A series the Income vs Spending chart can show or hide.
enum SpendingChartSeries: String, CaseIterable, Hashable {
  case income, spend, mortgage, average

  var title: String {
    switch self {
    case .income: "Income"
    case .spend: "Spend"
    case .mortgage: "Mortgage"
    case .average: "6-mo avg"
    }
  }

  var color: Color {
    switch self {
    case .income: DomaColor.warmPositive
    case .spend: DomaColor.warmAccent
    case .mortgage: DomaColor.warmTextPrimary
    case .average: DomaColor.warmTextSecondary
    }
  }
}

/// What the chart draws for a run of months. Bars sit in two slots per month: income, and spend
/// with the mortgage at its foot. Spend is everything that leaves, so the spend bar's top is the
/// month's spend whether or not the mortgage is picked out; hiding Mortgage only stops picking it out.
struct SpendingChartModel {
  enum Slot: String { case income, spend }

  struct Bar: Identifiable, Equatable {
    let month: DomaMonth
    let slot: Slot
    let series: SpendingChartSeries
    /// Dollars.
    let low: Double
    let high: Double
    /// Whether this segment is the top of its slot, which gets the rounded corners.
    let isTop: Bool

    var id: String { "\(month.key)-\(series.rawValue)" }
  }

  struct AveragePoint: Identifiable, Equatable {
    let month: DomaMonth
    let series: SpendingChartSeries
    /// Dollars.
    let value: Double

    var id: String { "\(month.key)-\(series.rawValue)" }
  }

  /// Oldest first.
  let months: [DomaSpending.Month]
  let visible: Set<SpendingChartSeries>

  var bars: [Bar] {
    months.flatMap { month -> [Bar] in
      var bars: [Bar] = []
      if visible.contains(.income) {
        bars.append(Bar(month: month.month, slot: .income, series: .income, low: 0, high: dollars(month.income), isTop: true))
      }
      let showsSpend = visible.contains(.spend)
      let showsMortgage = visible.contains(.mortgage) && month.mortgage != 0
      if showsMortgage {
        bars.append(
          Bar(month: month.month, slot: .spend, series: .mortgage, low: 0, high: dollars(month.mortgage), isTop: !showsSpend))
      }
      if showsSpend {
        let base = showsMortgage ? dollars(month.mortgage) : 0
        bars.append(Bar(month: month.month, slot: .spend, series: .spend, low: base, high: dollars(month.spend), isTop: true))
      }
      return bars
    }
  }

  /// The trailing six-month averages, for the series that are showing.
  var averages: [AveragePoint] {
    guard visible.contains(.average) else { return [] }
    return months.flatMap { month -> [AveragePoint] in
      var points: [AveragePoint] = []
      if visible.contains(.income) {
        points.append(AveragePoint(month: month.month, series: .income, value: dollars(month.incomeAverage)))
      }
      if visible.contains(.spend) {
        points.append(AveragePoint(month: month.month, series: .spend, value: dollars(month.spendAverage)))
      }
      return points
    }
  }

  /// The value axis in dollars: from 0, or below it for a month of refunds, to the tallest bar or
  /// average with a little room above.
  var valueDomain: ClosedRange<Double> {
    let values = bars.flatMap { [$0.low, $0.high] } + averages.map(\.value)
    return min(values.min() ?? 0, 0)...max((values.max() ?? 0) * 1.08, 1)
  }

  /// Which months get an axis label: every `stride`th, counted back from the latest, so the latest
  /// month is always labelled.
  func labelledMonths(fitting maximum: Int) -> [DomaMonth] {
    guard !months.isEmpty else { return [] }
    let stride = max(1, Int((Double(months.count) / Double(max(maximum, 1))).rounded(.up)))
    return months.enumerated().filter { (months.count - 1 - $0.offset) % stride == 0 }.map(\.element.month)
  }

  /// "Jan ’26" where the year turns, when the months span more than one year; otherwise "Jan".
  func axisLabel(for month: DomaMonth) -> String {
    let spansYears = (months.first?.month.year ?? month.year) != (months.last?.month.year ?? month.year)
    let name = SpendingFormat.shortMonth(month)
    guard spansYears, month.month == 1 else { return name }
    return "\(name) ’\(String(format: "%02d", month.year % 100))"
  }

  func month(_ month: DomaMonth) -> DomaSpending.Month? { months.first { $0.month == month } }

  private func dollars(_ cents: Int) -> Double { Double(cents) / 100 }
}

/// What the callout shows for one month. Its rows add up to the net, and match the month detail's
/// sections: spend is cards and one-offs, with shared outgoings and the mortgage on rows of their own.
struct SpendingChartReading: Equatable {
  let title: String
  let net: Int
  let income: Int
  let spend: Int
  /// Shown only when the month has any.
  let shared: Int
  let mortgage: Int

  init(_ month: DomaSpending.Month) {
    title = SpendingFormat.longMonthYear(month.month)
    net = month.net
    income = month.income
    spend = month.dayToDay
    shared = month.shared
    mortgage = month.mortgage
  }
}
