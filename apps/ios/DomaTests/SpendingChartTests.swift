import DomaKit
import Foundation
import Testing

@testable import Doma

/// The chart's bars and labels and the month detail's stepping, changes and categories. Amounts
/// are made up.
@MainActor
struct SpendingChartTests {
  private static func month(_ key: String) -> DomaMonth { DomaMonth(key: key)! }

  /// A month in cents, decoded as the server sends it. Spend includes the mortgage.
  private static func spendingMonth(
    _ key: String, income: Int = 900_000, dayToDay: Int = 300_000, shared: Int = 50_000, mortgage: Int = 250_000
  ) -> DomaSpending.Month {
    let spend = dayToDay + shared + mortgage
    let json = """
      {"monthKey":"\(key)","date":0,"income":\(income),"dayToDay":\(dayToDay),"shared":\(shared),\
      "mortgage":\(mortgage),"spend":\(spend),"net":\(income - spend),"incomeAverage":880000,"spendAverage":610000}
      """
    return try! JSONDecoder().decode(DomaSpending.Month.self, from: Data(json.utf8))
  }

  private static func net(_ key: String) -> DomaSpendingMonthNet {
    let date = key.replacingOccurrences(of: "-", with: "")
    let json = #"{"monthKey":"\#(key)","date":\#(date),"net":0}"#
    return try! JSONDecoder().decode(DomaSpendingMonthNet.self, from: Data(json.utf8))
  }

  // MARK: Bars

  @Test func theSpendBarPicksOutTheMortgageAtItsFoot() {
    let model = SpendingChartModel(months: [Self.spendingMonth("2026-10")], visible: Set(SpendingChartSeries.allCases))
    let bars = model.bars
    #expect(bars.map(\.series) == [.income, .mortgage, .spend])
    #expect(bars[0].low == 0 && bars[0].high == 9_000)
    #expect(bars[1].low == 0 && bars[1].high == 2_500 && !bars[1].isTop)
    // The spend bar's top is everything that leaves.
    #expect(bars[2].low == 2_500 && bars[2].high == 6_000 && bars[2].isTop)
  }

  @Test func hidingMortgageKeepsTheSpendBarsHeight() {
    let model = SpendingChartModel(months: [Self.spendingMonth("2026-10")], visible: [.income, .spend])
    #expect(model.bars.map(\.series) == [.income, .spend])
    #expect(model.bars[1].low == 0 && model.bars[1].high == 6_000)
  }

  @Test func hidingSpendLeavesTheMortgageAlone() {
    let model = SpendingChartModel(months: [Self.spendingMonth("2026-10")], visible: [.mortgage])
    #expect(model.bars.map(\.series) == [.mortgage])
    #expect(model.bars[0].isTop)
  }

  @Test func aMonthWithoutAMortgageDrawsNoMortgageBar() {
    let model = SpendingChartModel(
      months: [Self.spendingMonth("2026-10", mortgage: 0)], visible: Set(SpendingChartSeries.allCases))
    #expect(model.bars.map(\.series) == [.income, .spend])
  }

  @Test func averagesFollowTheirSeries() {
    let months = [Self.spendingMonth("2026-09"), Self.spendingMonth("2026-10")]
    #expect(SpendingChartModel(months: months, visible: Set(SpendingChartSeries.allCases)).averages.count == 4)
    #expect(SpendingChartModel(months: months, visible: [.income, .average]).averages.map(\.series) == [.income, .income])
    #expect(SpendingChartModel(months: months, visible: [.income, .spend]).averages.isEmpty)
  }

  @Test func theCalloutsRowsAddUpToTheNet() {
    let reading = SpendingChartReading(Self.spendingMonth("2026-10"))
    #expect(reading.title == "October 2026")
    #expect(reading.spend == 300_000)
    #expect(reading.shared == 50_000)
    #expect(reading.income - reading.spend - reading.shared - reading.mortgage == reading.net)
  }

  // MARK: Axis

  @Test func theValueAxisFitsTheTallestShownSeries() {
    let months = [Self.spendingMonth("2026-10", income: 1_000_000)]
    #expect(abs(SpendingChartModel(months: months, visible: [.income]).valueDomain.upperBound - 10_800) < 0.01)
    // Averages count too: spend averages 6,100 here, above the 6,000 bar.
    #expect(abs(SpendingChartModel(months: months, visible: [.spend, .average]).valueDomain.upperBound - 6_588) < 0.01)
    #expect(SpendingChartModel(months: [], visible: []).valueDomain == 0...1)
  }

  @Test func theLatestMonthIsAlwaysLabelled() {
    let keys = (1...12).map { String(format: "2026-%02d", $0) }
    let model = SpendingChartModel(months: keys.map { Self.spendingMonth($0) }, visible: [])
    #expect(model.labelledMonths(fitting: 12).count == 12)
    let six = model.labelledMonths(fitting: 6)
    #expect(six.map(\.key) == ["2026-02", "2026-04", "2026-06", "2026-08", "2026-10", "2026-12"])
    #expect(model.labelledMonths(fitting: 5).last == Self.month("2026-12"))
  }

  @Test func januaryCarriesTheYearOnlyAcrossYears() {
    let across = SpendingChartModel(months: [Self.spendingMonth("2025-12"), Self.spendingMonth("2026-01")], visible: [])
    #expect(across.axisLabel(for: Self.month("2026-01")) == "Jan ’26")
    #expect(across.axisLabel(for: Self.month("2025-12")) == "Dec")
    let within = SpendingChartModel(months: [Self.spendingMonth("2026-01"), Self.spendingMonth("2026-02")], visible: [])
    #expect(within.axisLabel(for: Self.month("2026-01")) == "Jan")
  }

  @Test func axisAmountsShortenThousands() {
    #expect(SpendingFormat.axisAmount(0) == "0")
    #expect(SpendingFormat.axisAmount(500) == "500")
    #expect(SpendingFormat.axisAmount(5_000) == "5k")
    #expect(SpendingFormat.axisAmount(12_000) == "12k")
    #expect(SpendingFormat.axisAmount(2_500) == "2.5k")
  }

  // MARK: Month detail

  @Test func aMonthDetailDecodesWithoutAMortgageOrEarlierMonth() throws {
    let json = """
      {"date":1790000000000,"shared":20000,"net":150000,
       "income":{"primary":500000,"secondary":100000,"billContrib":20000,"total":620000},
       "spend":{"credit1":1,"credit2":2,"credit3":3,"cardSubtotal":6,
                "categories":[{"category":"Groceries","amount":90000}],"oneOffs":10000,"total":450000},
       "mortgage":null,"trends":{"income":null,"spend":null,"mortgage":null}}
      """
    let detail = try JSONDecoder().decode(DomaSpendingMonthDetail?.self, from: Data(json.utf8))
    #expect(detail?.mortgage == nil)
    #expect(detail?.trends.income == nil)
    #expect(detail?.shared == 20_000)
    #expect(detail?.spend.categories == [DomaSpendingMonthDetail.Category(category: "Groceries", amount: 90_000)])
    #expect(try JSONDecoder().decode(DomaSpendingMonthDetail?.self, from: Data("null".utf8)) == nil)
  }

  @Test func steppingCrossesEveryMonthWithData() {
    let months = ["2026-08", "2026-09", "2026-10"].map(Self.net)
    let middle = SpendingMonthStepper(months: months, current: Self.month("2026-09"))
    #expect(middle.previous == Self.month("2026-08"))
    #expect(middle.next == Self.month("2026-10"))
    #expect(middle.date == months[1].date)
    #expect(SpendingMonthStepper(months: months, current: Self.month("2026-08")).previous == nil)
    #expect(SpendingMonthStepper(months: months, current: Self.month("2026-10")).next == nil)
  }

  @Test func aFallInSpendIsGoodNewsAndAFallInIncomeIsQuiet() {
    let down = DomaSpendingMonthDetail.Trend(pct: -4.1, direction: .down)
    let september = Self.month("2026-09")
    let spend = SpendingMonthTrend(down, before: september, lowerIsBetter: true)
    #expect(spend?.text == "▼ 4.1% vs Sep")
    #expect(spend?.spokenText == "Down 4.1% on September")
    #expect(spend?.isGood == true)
    #expect(SpendingMonthTrend(down, before: september)?.isGood == false)
    let flat = DomaSpendingMonthDetail.Trend(pct: 0, direction: .flat)
    #expect(SpendingMonthTrend(flat, before: september)?.text == "Flat vs Sep")
    #expect(SpendingMonthTrend(nil, before: september) == nil)
    #expect(SpendingMonthTrend(down, before: nil) == nil)
  }

  @Test func categoriesShowTheLargestFiveUntilShowAll() {
    let categories = (1...7).map {
      DomaSpendingMonthDetail.Category(category: "Category \($0)", amount: 80_000 - $0 * 10_000)
    }
    let preview = SpendingCategoryPreview(categories: categories, showsAll: false)
    #expect(preview.shown.count == 5)
    #expect(preview.canExpand)
    #expect(SpendingCategoryPreview(categories: categories, showsAll: true).shown.count == 7)
    #expect(preview.share(of: categories[0]) == 1)
    #expect(preview.share(of: categories[6]) == 10_000.0 / 70_000)
    #expect(!SpendingCategoryPreview(categories: Array(categories.prefix(5)), showsAll: false).canExpand)
  }
}
