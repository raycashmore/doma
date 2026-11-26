import DomaKit
import SwiftUI

/// Income vs Spending across the whole screen, in landscape on iPhone. Touching or dragging reads a
/// month; the chips hide or show each series; the range button opens the Time range sheet.
struct SpendingFullScreenChart: View {
  let spending: DomaSpending
  let months: [DomaSpendingMonthNet]
  let available: DomaMonthRange
  @Binding var choice: SpendingRangeChoice
  let onOpen: (DomaMonth) -> Void
  @State private var visible = Set(SpendingChartSeries.allCases)
  @State private var selected: DomaMonth?
  @State private var isChoosingRange = false
  @Environment(\.dismiss) private var dismiss
  @ScaledMetric(relativeTo: .headline) private var closeSize: CGFloat = 40

  private var range: DomaMonthRange { choice.range(within: available) ?? available }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      header
      SpendingChart(
        model: SpendingChartModel(months: spending.months, visible: visible),
        reading: .drag, maximumLabels: 18, selected: $selected, onOpen: onOpen
      )
      // A new range keeps the last bars, faded, until its own arrive.
      .opacity(spending.from == range.from && spending.to == range.to ? 1 : 0.5)
      .frame(maxHeight: .infinity)
      SpendingSeriesChips(visible: $visible)
    }
    .padding(.horizontal, 20)
    .padding(.vertical, 12)
    .background(DomaColor.sheetBackground.ignoresSafeArea())
    .onChange(of: spending.months.map(\.month)) { selected = nil }
    .onAppear { OrientationLock.landscape() }
    .onDisappear { OrientationLock.release() }
    .sheet(isPresented: $isChoosingRange) {
      SpendingRangeSheet(months: months, available: available, initial: choice) { choice = $0 }
    }
  }

  private var header: some View {
    HStack(spacing: 12) {
      Button { dismiss() } label: {
        Image(systemName: "xmark")
          .domaFont(.sectionHeader)
          .foregroundStyle(DomaColor.warmTextPrimary)
          .frame(width: closeSize, height: closeSize)
          .background(DomaColor.warmChip, in: .circle)
          .frame(minWidth: 44, minHeight: 44)
          .contentShape(.rect)
      }
      .buttonStyle(.plain)
      .accessibilityLabel("Close")
      Text("Income vs spending")
        .domaFont(.sheetTitle)
        .foregroundStyle(DomaColor.warmTextPrimary)
        .accessibilityAddTraits(.isHeader)
        .frame(maxWidth: .infinity, alignment: .leading)
      SpendingRangeButton(range: range, showsCount: false) { isChoosingRange = true }
    }
  }
}

/// A chip per series: tap to hide it, tap again to bring it back.
private struct SpendingSeriesChips: View {
  @Binding var visible: Set<SpendingChartSeries>

  var body: some View {
    HStack(spacing: 10) {
      ForEach(SpendingChartSeries.allCases, id: \.self) { series in
        chip(series)
      }
      Spacer(minLength: 12)
      Text("Tap a series to hide it")
        .domaFont(.detail)
        .foregroundStyle(DomaColor.warmTextTertiary)
        .lineLimit(1)
        .accessibilityHidden(true)
    }
  }

  private func chip(_ series: SpendingChartSeries) -> some View {
    let isOn = visible.contains(series)
    return Button {
      if isOn { visible.remove(series) } else { visible.insert(series) }
    } label: {
      HStack(spacing: 6) {
        if series == .average {
          Text("--").tracking(-1).foregroundStyle(DomaColor.warmTextSecondary)
        } else {
          RoundedRectangle(cornerRadius: 2).fill(series.color).frame(width: 9, height: 9)
        }
        Text(series.title)
          .foregroundStyle(DomaColor.warmTextPrimary)
      }
      .domaFont(.supporting)
      .padding(.horizontal, 12)
      .frame(minHeight: 32)
      .background(DomaColor.warmBgCard, in: .capsule)
      .overlay { Capsule().strokeBorder(DomaColor.warmBorder) }
      .opacity(isOn ? 1 : 0.45)
      .frame(minHeight: 44)
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityLabel(series == .average ? "Six-month averages" : series.title)
    .accessibilityValue(isOn ? "Shown" : "Hidden")
    .accessibilityHint(isOn ? "Hides it from the chart" : "Shows it on the chart")
  }
}
