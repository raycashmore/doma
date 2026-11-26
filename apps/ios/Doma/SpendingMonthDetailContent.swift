import DomaKit
import SwiftUI

/// The month detail's figures: the net, then income, spend, shared outgoings and the mortgage, which
/// together make it up.
struct SpendingMonthDetailContent: View {
  let month: DomaMonth
  /// The month with data before this one, which the changes compare against.
  let prior: DomaMonth?
  let detail: DomaSpendingMonthDetail

  var body: some View {
    VStack(alignment: .leading, spacing: 20) {
      title
      section(
        .income, total: detail.income.total,
        trend: SpendingMonthTrend(detail.trends.income, before: prior)
      ) {
        SpendingDetailRows(rows: [
          ("Primary income", detail.income.primary),
          ("Secondary income", detail.income.secondary),
          ("Bill contributions", detail.income.billContrib),
        ])
      }
      section(
        .spend, total: detail.spend.total,
        trend: SpendingMonthTrend(detail.trends.spend, before: prior, lowerIsBetter: true)
      ) {
        SpendingCategoryCard(categories: detail.spend.categories, oneOffs: detail.spend.oneOffs)
      }
      if detail.shared != 0 {
        sectionHeader(title: "Shared outgoings", color: DomaColor.warmTextTertiary, total: detail.shared, trend: nil)
      }
      if let mortgage = detail.mortgage {
        section(.mortgage, total: mortgage.paymentTotal, trend: nil) {
          SpendingDetailRows(rows: [
            ("Fixed payment", mortgage.fixedPayment),
            ("Variable payment", mortgage.variablePayment),
          ])
        }
      }
    }
  }

  private var title: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(SpendingFormat.longMonthYear(month))
        .domaFont(.kicker)
        .tracking(1)
        .textCase(.uppercase)
        .foregroundStyle(DomaColor.warmTextSecondary)
        .accessibilityAddTraits(.isHeader)
      ViewThatFits(in: .horizontal) {
        HStack(alignment: .firstTextBaseline, spacing: 10) { net; netCaption }
        VStack(alignment: .leading, spacing: 2) { net; netCaption }
      }
      .accessibilityElement(children: .combine)
    }
  }

  private var net: some View {
    Text(SpendingFormat.signedMoney(detail.net))
      .domaFont(.figure)
      .monospacedDigit()
      .foregroundStyle(detail.net < 0 ? DomaColor.warmNegativeText : DomaColor.warmPositiveText)
      .lineLimit(1)
      .minimumScaleFactor(0.6)
  }

  private var netCaption: some View {
    Text("net for the month")
      .domaFont(.supporting)
      .foregroundStyle(DomaColor.warmTextSecondary)
  }

  private func section(
    _ series: SpendingChartSeries, total: Int, trend: SpendingMonthTrend?,
    @ViewBuilder card: () -> some View
  ) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      sectionHeader(title: series.title, color: series.color, total: total, trend: trend)
      card()
    }
  }

  private func sectionHeader(title: String, color: Color, total: Int, trend: SpendingMonthTrend?) -> some View {
    HStack(alignment: .firstTextBaseline, spacing: 8) {
      RoundedRectangle(cornerRadius: 3)
        .fill(color)
        .frame(width: 10, height: 10)
        .accessibilityHidden(true)
      Text(title)
        .domaFont(.sectionHeader)
        .foregroundStyle(DomaColor.warmTextPrimary)
        .frame(maxWidth: .infinity, alignment: .leading)
      if let trend {
        Text(trend.text)
          .domaFont(.detail)
          .foregroundStyle(trend.color)
          .accessibilityLabel(trend.spokenText)
      }
      Text(SpendingFormat.money(total))
        .domaFont(.amount)
        .monospacedDigit()
        .foregroundStyle(DomaColor.warmTextPrimary)
    }
    .padding(.horizontal, 4)
    .accessibilityElement(children: .combine)
    .accessibilityAddTraits(.isHeader)
  }
}

/// Label and amount rows on a card, divided by hairlines.
private struct SpendingDetailRows: View {
  let rows: [(label: String, amount: Int)]

  var body: some View {
    VStack(spacing: 0) {
      ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
        if index > 0 {
          Rectangle().fill(DomaColor.warmBorder).frame(height: 1)
        }
        HStack(spacing: 12) {
          Text(row.label)
            .foregroundStyle(DomaColor.warmTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
          Text(SpendingFormat.money(row.amount))
            .monospacedDigit()
            .foregroundStyle(DomaColor.warmTextPrimary)
        }
        .domaFont(.supporting)
        .padding(.trailing, 16)
        .padding(.vertical, 12)
        .accessibilityElement(children: .combine)
      }
    }
    .padding(.leading, 16)
    .domaCardSurface()
  }
}
