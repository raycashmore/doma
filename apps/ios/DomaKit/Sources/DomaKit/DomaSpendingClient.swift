import Combine
@preconcurrency import ConvexMobile
import Foundation

/// A calendar month, as the server's `YYYY-MM` month keys name them.
public struct DomaMonth: Hashable, Comparable, Sendable, Decodable, CustomStringConvertible {
  public let year: Int
  /// 1 to 12.
  public let month: Int

  public init(year: Int, month: Int) {
    let index = year * 12 + (month - 1)
    self.year = Int((Double(index) / 12).rounded(.down))
    self.month = index - self.year * 12 + 1
  }

  /// `nil` unless `key` is `YYYY-MM` with a month from 01 to 12.
  public init?(key: String) {
    let parts = key.split(separator: "-", omittingEmptySubsequences: false)
    guard parts.count == 2, parts[0].count == 4, parts[1].count == 2,
      let year = Int(parts[0]), let month = Int(parts[1]), (1...12).contains(month)
    else { return nil }
    self.init(year: year, month: month)
  }

  public var key: String { String(format: "%04d-%02d", year, month) }
  public var description: String { key }

  public func adding(months: Int) -> DomaMonth { DomaMonth(year: year, month: month + months) }

  /// Whole months from `self` to `other`: 0 for the same month, negative when `other` is earlier.
  public func months(to other: DomaMonth) -> Int { (other.year - year) * 12 + (other.month - month) }

  public static func < (lhs: DomaMonth, rhs: DomaMonth) -> Bool {
    (lhs.year, lhs.month) < (rhs.year, rhs.month)
  }

  public init(from decoder: any Decoder) throws {
    let key = try decoder.singleValueContainer().decode(String.self)
    guard let month = DomaMonth(key: key) else {
      throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Not a YYYY-MM month"))
    }
    self = month
  }
}

/// An inclusive run of months, `from` no later than `to`.
public struct DomaMonthRange: Hashable, Sendable {
  public let from: DomaMonth
  public let to: DomaMonth

  /// `nil` when `from` is after `to`.
  public init?(from: DomaMonth, to: DomaMonth) {
    guard from <= to else { return nil }
    self.from = from
    self.to = to
  }

  /// Calendar months in the range, counting months without data.
  public var monthCount: Int { from.months(to: to) + 1 }

  public func contains(_ month: DomaMonth) -> Bool { from <= month && month <= to }
}

/// One month's net, from `spending:listMonths`, for the range strip and the presets.
public struct DomaSpendingMonthNet: Decodable, Equatable, Sendable {
  public let month: DomaMonth
  /// The budget row's month-end date, milliseconds since 1970.
  public let date: Double
  /// Cents.
  public let net: Int

  private enum CodingKeys: String, CodingKey { case month = "monthKey", date, net }
}

/// A chosen range's figures and months, from `spending:getSpending`. Money is in cents; the
/// server defines income, spend and net (`packages/convex/convex/spendingModel.ts`).
public struct DomaSpending: Decodable, Equatable, Sendable {
  public let from: DomaMonth
  public let to: DomaMonth
  /// Months in the range that have data, oldest first.
  public let months: [Month]
  public let summary: Summary

  public struct Month: Decodable, Equatable, Identifiable, Sendable {
    public let month: DomaMonth
    public let date: Double
    public let income: Int
    public let dayToDay: Int
    public let shared: Int
    public let mortgage: Int
    public let spend: Int
    public let net: Int
    public let incomeAverage: Int
    public let spendAverage: Int

    public var id: DomaMonth { month }

    private enum CodingKeys: String, CodingKey {
      case month = "monthKey", date, income, dayToDay, shared, mortgage, spend, net, incomeAverage, spendAverage
    }
  }

  public struct Summary: Decodable, Equatable, Sendable {
    /// Months in the range that have data.
    public let monthCount: Int
    public let avgIncome: Metric
    public let avgSpend: Metric
    public let avgNet: Metric
    /// Basis points: 12.34% is 1234.
    public let savingsRate: Metric
    /// The same number of months just before the range, or `nil` when none of them has data.
    public let comparison: Comparison?
  }

  public struct Metric: Decodable, Equatable, Sendable {
    public let value: Int
    /// `nil` without a comparison.
    public let delta: Int?
    /// `nil` without a comparison, or when the earlier value was 0.
    public let deltaPct: Double?

    public init(value: Int, delta: Int?, deltaPct: Double?) {
      self.value = value
      self.delta = delta
      self.deltaPct = deltaPct
    }
  }

  public struct Comparison: Decodable, Equatable, Sendable {
    public let from: DomaMonth
    public let to: DomaMonth
    /// Months in the comparison range that have data.
    public let monthCount: Int
  }
}

/// Spending reads. Anyone signed in to the household can read them; there are no writes.
public struct DomaSpendingClient: Sendable {
  private let convex: ConvexClient

  public init(convex: ConvexClient) {
    self.convex = convex
  }

  /// Every month's net, oldest first.
  public func months() -> AnyPublisher<[DomaSpendingMonthNet], ClientError> {
    convex.subscribe(to: "spending:listMonths")
  }

  public func spending(in range: DomaMonthRange) -> AnyPublisher<DomaSpending, ClientError> {
    convex.subscribe(to: "spending:getSpending", with: ["from": range.from.key, "to": range.to.key])
  }
}
