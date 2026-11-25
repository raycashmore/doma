import DomaKit
import Foundation
import Testing

@testable import Doma

@MainActor
struct SpendingRangeTests {
  private static func month(_ key: String) -> DomaMonth { DomaMonth(key: key)! }

  private static func range(_ from: String, _ to: String) -> DomaMonthRange {
    DomaMonthRange(from: month(from), to: month(to))!
  }

  // MARK: Months

  @Test func monthKeysParseOnlyRealMonths() {
    #expect(DomaMonth(key: "2026-10") == DomaMonth(year: 2026, month: 10))
    #expect(DomaMonth(key: "2026-13") == nil)
    #expect(DomaMonth(key: "2026-00") == nil)
    #expect(DomaMonth(key: "2026-1") == nil)
    #expect(DomaMonth(key: "26-10") == nil)
    #expect(Self.month("2026-03").key == "2026-03")
  }

  @Test func shiftingCrossesYearsBothWays() {
    #expect(Self.month("2026-01").adding(months: -1) == Self.month("2025-12"))
    #expect(Self.month("2025-12").adding(months: 1) == Self.month("2026-01"))
    #expect(Self.month("2026-05").adding(months: -17) == Self.month("2024-12"))
    #expect(Self.month("2025-11").months(to: Self.month("2026-04")) == 5)
  }

  @Test func aRangeCountsItsEndMonths() {
    #expect(Self.range("2026-08", "2026-10").monthCount == 3)
    #expect(Self.range("2026-10", "2026-10").monthCount == 1)
    #expect(DomaMonthRange(from: Self.month("2026-10"), to: Self.month("2026-09")) == nil)
  }

  // MARK: Presets

  /// Data from March 2023 to October 2026.
  private static let available = range("2023-03", "2026-10")

  @Test func lastMonthsPresetsEndAtTheLatestMonthWithData() {
    #expect(SpendingRangePreset.threeMonths.range(within: Self.available) == Self.range("2026-08", "2026-10"))
    #expect(SpendingRangePreset.sixMonths.range(within: Self.available) == Self.range("2026-05", "2026-10"))
    #expect(SpendingRangePreset.twelveMonths.range(within: Self.available) == Self.range("2025-11", "2026-10"))
    #expect(SpendingRangePreset.all.range(within: Self.available) == Self.available)
  }

  @Test func financialYearsRunJulyToJune() {
    #expect(SpendingRangePreset.thisFinancialYear.range(within: Self.available) == Self.range("2026-07", "2026-10"))
    #expect(SpendingRangePreset.lastFinancialYear.range(within: Self.available) == Self.range("2025-07", "2026-06"))

    // Before July, this financial year began the previous July.
    let toApril = Self.range("2023-03", "2026-04")
    #expect(SpendingRangePreset.thisFinancialYear.range(within: toApril) == Self.range("2025-07", "2026-04"))
    #expect(SpendingRangePreset.lastFinancialYear.range(within: toApril) == Self.range("2024-07", "2025-06"))

    // June ends a financial year; July starts one.
    #expect(SpendingRangePreset.thisFinancialYear.range(within: Self.range("2023-03", "2026-06")) == Self.range("2025-07", "2026-06"))
    #expect(SpendingRangePreset.thisFinancialYear.range(within: Self.range("2023-03", "2026-07")) == Self.range("2026-07", "2026-07"))
  }

  @Test func lastFinancialYearNeedsSomeDataInIt() {
    #expect(SpendingRangePreset.lastFinancialYear.range(within: Self.range("2026-08", "2026-10")) == nil)
    // One month of last year is enough.
    #expect(SpendingRangePreset.lastFinancialYear.range(within: Self.range("2026-06", "2026-10")) == Self.range("2026-06", "2026-06"))
  }

  @Test func presetsStopAtTheFirstMonthWithData() {
    let fourMonths = Self.range("2026-07", "2026-10")
    #expect(SpendingRangePreset.sixMonths.range(within: fourMonths) == fourMonths)
    #expect(SpendingRangePreset.twelveMonths.range(within: fourMonths) == fourMonths)
    #expect(SpendingRangePreset.threeMonths.range(within: fourMonths) == Self.range("2026-08", "2026-10"))
  }

  @Test func aPresetFollowsNewMonthsButAPickedRangeStays() {
    let sixMonths = SpendingRangeChoice.preset(.sixMonths)
    // November arrives.
    let withNovember = Self.range("2023-03", "2026-11")
    #expect(sixMonths.range(within: withNovember) == Self.range("2026-06", "2026-11"))

    let picked = SpendingRangeChoice.picked(Self.range("2026-02", "2026-05"))
    #expect(picked.range(within: withNovember) == Self.range("2026-02", "2026-05"))
    #expect(SpendingRangeChoice.initial.range(within: Self.available) == Self.range("2026-05", "2026-10"))
  }

  @Test func aPresetKeepsItsOwnRuleWhenItMatchesAnother() {
    // In September, This FY and 3 mo both give July to September.
    let toSeptember = Self.range("2023-03", "2026-09")
    let thisYear = SpendingRangeChoice.preset(.thisFinancialYear)
    #expect(thisYear.range(within: toSeptember) == SpendingRangePreset.threeMonths.range(within: toSeptember))
    // October arrives: This FY grows; it does not slide like 3 mo.
    #expect(thisYear.range(within: Self.available) == Self.range("2026-07", "2026-10"))
  }

  @Test func lastFinancialYearWithoutDataFallsBackToTheDefault() {
    let recent = Self.range("2026-08", "2026-10")
    #expect(SpendingRangeChoice.preset(.lastFinancialYear).range(within: recent) == recent)
  }

  // MARK: Dragging the strip

  @Test func theNearerEndWinsWithinTheGrabArea() {
    // Ends 30 pt apart: each grab area overlaps the other's.
    #expect(SpendingRangeDrag.handle(startingAt: 105, fromEdge: 100, toEdge: 130) == .from)
    #expect(SpendingRangeDrag.handle(startingAt: 125, fromEdge: 100, toEdge: 130) == .to)
    #expect(SpendingRangeDrag.handle(startingAt: 140, fromEdge: 100, toEdge: 130) == .to)
    #expect(SpendingRangeDrag.handle(startingAt: 80, fromEdge: 100, toEdge: 130) == .from)
  }

  @Test func theMiddleMovesTheWholeRangeAndOutsidePullsAnEnd() {
    #expect(SpendingRangeDrag.handle(startingAt: 200, fromEdge: 100, toEdge: 300) == .whole)
    #expect(SpendingRangeDrag.handle(startingAt: 20, fromEdge: 100, toEdge: 300) == .from)
    #expect(SpendingRangeDrag.handle(startingAt: 380, fromEdge: 100, toEdge: 300) == .to)
  }

  @Test func draggingAnEndStopsAtTheOtherEnd() {
    let original = Self.range("2026-05", "2026-10")
    let from = SpendingRangeDrag.range(
      dragging: .from, original: original, from: Self.month("2026-05"), to: Self.month("2024-10"),
      within: Self.available)
    #expect(from == Self.range("2024-10", "2026-10"))

    let crossed = SpendingRangeDrag.range(
      dragging: .to, original: original, from: Self.month("2026-10"), to: Self.month("2026-01"),
      within: Self.available)
    #expect(crossed == Self.range("2026-05", "2026-05"))
  }

  @Test func movingTheWholeRangeKeepsItsLengthInsideTheData() {
    let original = Self.range("2026-05", "2026-10")
    let back = SpendingRangeDrag.range(
      dragging: .whole, original: original, from: Self.month("2026-07"), to: Self.month("2026-02"),
      within: Self.available)
    #expect(back == Self.range("2025-12", "2026-05"))

    // Already at the latest month, it cannot move later.
    let forward = SpendingRangeDrag.range(
      dragging: .whole, original: original, from: Self.month("2026-07"), to: Self.month("2026-09"),
      within: Self.available)
    #expect(forward == original)

    let pastStart = SpendingRangeDrag.range(
      dragging: .whole, original: original, from: Self.month("2026-07"), to: Self.month("2010-01"),
      within: Self.available)
    #expect(pastStart == Self.range("2023-03", "2023-08"))
  }

  // MARK: Formatting

  @Test func moneyIsWholeDollarsWithAHyphenForLosses() {
    #expect(SpendingFormat.money(184_000) == "$1,840")
    #expect(SpendingFormat.money(123_456) == "$1,235")
    #expect(SpendingFormat.money(-50_000) == "-$500")
    #expect(SpendingFormat.money(0) == "$0")
    #expect(SpendingFormat.signedMoney(210_000) == "+$2,100")
    #expect(SpendingFormat.signedMoney(-50_000) == "-$500")
    #expect(SpendingFormat.signedMoney(40) == "$0")
    #expect(SpendingFormat.percent(basisPoints: 1950) == "19.5%")
  }

  @Test func rangeTitlesNameTheYearOnceWhenTheyShareIt() {
    #expect(SpendingFormat.rangeTitle(Self.range("2026-05", "2026-10")) == "May – Oct 2026")
    #expect(SpendingFormat.rangeTitle(Self.range("2025-11", "2026-04")) == "Nov 2025 – Apr 2026")
    #expect(SpendingFormat.rangeTitle(Self.range("2026-10", "2026-10")) == "Oct 2026")
  }

  @Test func theUpdatedLineReadsTheMonthEndInUTC() {
    // 31 October 2026 at 23:00 UTC is already 1 November in Sydney.
    #expect(SpendingFormat.updated(1_793_487_600_000) == "Updated 31 October")
  }

  @Test func changesAreColouredByWhetherTheyHelp() {
    let incomeUp = SpendingChange(.init(value: 942_000, delta: 19_400, deltaPct: 2.104), kind: .percent)
    #expect(incomeUp?.text == "▲ 2.1%")
    #expect(incomeUp?.tone == .good)

    let spendDown = SpendingChange(.init(value: 758_000, delta: -26_700, deltaPct: -3.4), kind: .percent, lowerIsBetter: true)
    #expect(spendDown?.text == "▼ 3.4%")
    #expect(spendDown?.tone == .good)
    #expect(spendDown?.spokenText == "Down 3.4%")

    let gain = SpendingChange(.init(value: 184_000, delta: 32_000, deltaPct: 21), kind: .money)
    #expect(gain?.text == "▲ $320")

    let saved = SpendingChange(.init(value: 1950, delta: -180, deltaPct: nil), kind: .points)
    #expect(saved?.text == "▼ 1.8 pp")
    #expect(saved?.tone == .bad)

    // From an earlier 0 there is no percentage, so the amount shows instead.
    let fromZero = SpendingChange(.init(value: 10_000, delta: 10_000, deltaPct: nil), kind: .percent)
    #expect(fromZero?.text == "▲ $100")

    #expect(SpendingChange(.init(value: 0, delta: 0, deltaPct: 0), kind: .percent)?.tone == .neutral)
    // Changes too small to show read as none rather than "▲ $0".
    #expect(SpendingChange(.init(value: 100, delta: 30, deltaPct: 0.3), kind: .money)?.text == "No change")
    #expect(SpendingChange(.init(value: 100, delta: 30, deltaPct: 0.04), kind: .percent)?.direction == .flat)
    #expect(SpendingChange(.init(value: 100, delta: 4, deltaPct: nil), kind: .points)?.direction == .flat)
    #expect(SpendingChange(.init(value: 1, delta: nil, deltaPct: nil), kind: .money) == nil)
  }

  @Test func spendingDecodesTheServerShape() throws {
    let json = #"""
      {"from":"2026-09","to":"2026-10","months":[
        {"monthKey":"2026-10","date":1793487600000,"income":940000,"dayToDay":500000,"shared":80000,
         "mortgage":150000,"spend":730000,"net":210000,"incomeAverage":930000,"spendAverage":745000}],
       "summary":{"monthCount":1,
         "avgIncome":{"value":940000,"delta":null,"deltaPct":null},
         "avgSpend":{"value":730000,"delta":-1000,"deltaPct":-0.1},
         "avgNet":{"value":210000,"delta":1000,"deltaPct":0.5},
         "savingsRate":{"value":2234,"delta":12,"deltaPct":0.5},
         "comparison":{"from":"2026-07","to":"2026-08","monthCount":2}}}
      """#
    let spending = try JSONDecoder().decode(DomaSpending.self, from: Data(json.utf8))
    #expect(spending.from == Self.month("2026-09"))
    #expect(spending.months.first?.month == Self.month("2026-10"))
    #expect(spending.summary.avgIncome.delta == nil)
    #expect(spending.summary.comparison?.monthCount == 2)
  }
}
