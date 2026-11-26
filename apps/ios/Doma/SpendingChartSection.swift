import DomaKit
import SwiftUI

/// The overview card's Income vs Spending: its legend, the expand button and the chart.
struct SpendingChartSection: View {
  let months: [DomaSpending.Month]
  let onExpand: () -> Void
  let onOpen: (DomaMonth) -> Void
  @State private var selected: DomaMonth?
  @ScaledMetric(relativeTo: .footnote) private var chartHeight: CGFloat = 190
  @ScaledMetric(relativeTo: .footnote) private var expandSize: CGFloat = 36

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      VStack(alignment: .leading, spacing: 8) {
        HStack(alignment: .center, spacing: 12) {
          Text("Income vs spending")
            .domaFont(.sectionHeader)
            .foregroundStyle(DomaColor.warmTextPrimary)
            .accessibilityAddTraits(.isHeader)
            .frame(maxWidth: .infinity, alignment: .leading)
          Button(action: onExpand) {
            Image(systemName: "arrow.up.left.and.arrow.down.right")
              .domaFont(.detailEmphasis)
              .foregroundStyle(DomaColor.warmTextPrimary)
              .frame(width: expandSize, height: expandSize)
              .background(DomaColor.warmChip, in: .circle)
              .frame(minWidth: 44, minHeight: 44)
              .contentShape(.rect)
          }
          .buttonStyle(.plain)
          .padding(.vertical, -4)
          .padding(.trailing, -4)
          .accessibilityLabel("Show the chart full screen")
        }
        SpendingChartLegend()
      }
      SpendingChart(
        model: SpendingChartModel(months: months, visible: Set(SpendingChartSeries.allCases)),
        reading: .holdToDrag, maximumLabels: 6, selected: $selected, onOpen: onOpen
      )
      .frame(height: chartHeight)
    }
    // A new range starts with nothing picked.
    .onChange(of: months.map(\.month)) { selected = nil }
  }
}

/// Income, Spend, Mortgage and the dashed average, as the card's chart draws them.
private struct SpendingChartLegend: View {
  var body: some View {
    ViewThatFits(in: .horizontal) {
      HStack(spacing: 14) {
        bars
        average
      }
      VStack(alignment: .leading, spacing: 4) {
        HStack(spacing: 14) { bars }
        average
      }
      VStack(alignment: .leading, spacing: 4) {
        bars
        average
      }
    }
    .domaFont(.detail)
    .foregroundStyle(DomaColor.warmTextSecondary)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Income, spend and mortgage bars, with dashed six-month averages")
  }

  private var bars: some View {
    ForEach([SpendingChartSeries.income, .spend, .mortgage], id: \.self) { series in
      HStack(spacing: 6) {
        RoundedRectangle(cornerRadius: 2).fill(series.color).frame(width: 9, height: 9)
        Text(series.title)
      }
    }
  }

  private var average: some View {
    HStack(spacing: 6) {
      Text("---")
        .tracking(-1)
      Text(SpendingChartSeries.average.title)
    }
  }
}
