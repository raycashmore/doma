@preconcurrency import ConvexMobile
import Foundation
import Testing

import DomaKit

extension LiveListsContractTests {
  /// Reads Spending through `DomaSpendingClient`, so its Swift models and month-key arguments are
  /// checked against Convex. It works with or without finance data in the deployment, and asserts
  /// only on months and counts, so no amount appears in a test failure or log.
  func checkSpending(on convex: ConvexClient) async throws {
    let spending = DomaSpendingClient(convex: convex)
    let months = try await LiveValues(spending.months()).next("spending months") { _ in true }
    #expect(months.map(\.month) == months.map(\.month).sorted())

    // The latest three months with data, or a fixed quarter when there is none.
    let latest = months.last?.month ?? DomaMonth(year: 2026, month: 3)
    let range = try #require(DomaMonthRange(from: latest.adding(months: -2), to: latest))
    let result = try await LiveValues(spending.spending(in: range)).next("spending in range") { _ in true }

    #expect(result.from == range.from)
    #expect(result.to == range.to)
    #expect(result.months.allSatisfy { range.contains($0.month) })
    #expect(result.months.map(\.month) == months.map(\.month).filter(range.contains))
    #expect(result.summary.monthCount == result.months.count)
    if let comparison = result.summary.comparison {
      #expect(comparison.from == range.from.adding(months: -3))
      #expect(comparison.to == range.from.adding(months: -1))
    }

    // The latest month's detail decodes and belongs to its budget row.
    if let latestMonth = months.last {
      let detail = try await LiveValues(spending.monthDetail(date: latestMonth.date)).next("month detail") { _ in true }
      #expect(detail?.date == latestMonth.date)
    }
  }
}
