import DomaKit

/// The Time range sheet's shortcut chips. Each resolves against the months that have data, as the
/// web's tabs do, so "6 mo" means the latest six months with figures, not the six before today.
enum SpendingRangePreset: CaseIterable, Identifiable {
  case threeMonths
  case sixMonths
  case twelveMonths
  case thisFinancialYear
  case lastFinancialYear
  case all

  static let defaultPreset = SpendingRangePreset.sixMonths

  var id: Self { self }

  var label: String {
    switch self {
    case .threeMonths: "3 mo"
    case .sixMonths: "6 mo"
    case .twelveMonths: "12 mo"
    case .thisFinancialYear: "This FY"
    case .lastFinancialYear: "Last FY"
    case .all: "All"
    }
  }

  /// `available` runs from the first to the latest month with data. The range is cut to the months
  /// with data, so with four months, 6 mo gives those four. `nil` when the preset has none of them,
  /// which only happens to Last FY.
  func range(within available: DomaMonthRange) -> DomaMonthRange? {
    let latest = available.to
    let wanted: DomaMonthRange? =
      switch self {
      case .threeMonths: Self.last(3, endingAt: latest)
      case .sixMonths: Self.last(6, endingAt: latest)
      case .twelveMonths: Self.last(12, endingAt: latest)
      case .thisFinancialYear: DomaMonthRange(from: Self.financialYearStart(of: latest), to: latest)
      case .lastFinancialYear:
        DomaMonthRange(
          from: Self.financialYearStart(of: latest).adding(months: -12),
          to: Self.financialYearStart(of: latest).adding(months: -1))
      case .all: available
      }
    guard let wanted else { return nil }
    return DomaMonthRange(from: max(wanted.from, available.from), to: min(wanted.to, available.to))
  }

  private static func last(_ count: Int, endingAt latest: DomaMonth) -> DomaMonthRange? {
    DomaMonthRange(from: latest.adding(months: -(count - 1)), to: latest)
  }

  /// Australian financial years run from July to June.
  static func financialYearStart(of month: DomaMonth) -> DomaMonth {
    DomaMonth(year: month.month >= 7 ? month.year : month.year - 1, month: 7)
  }
}

/// What the person chose: a preset follows the data as months arrive or go, a range picked by month stays put.
enum SpendingRangeChoice: Equatable {
  case preset(SpendingRangePreset)
  case picked(DomaMonthRange)

  static let initial = SpendingRangeChoice.preset(.defaultPreset)

  func range(within available: DomaMonthRange) -> DomaMonthRange? {
    switch self {
    case .preset(let preset):
      preset.range(within: available) ?? SpendingRangePreset.defaultPreset.range(within: available)
    case .picked(let range): range
    }
  }
}
