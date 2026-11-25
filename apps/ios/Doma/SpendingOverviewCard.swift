import DomaKit
import SwiftUI

/// The range button, the average monthly gain and the income, spend and saved figures, each with
/// its change against the same number of months just before the range.
struct SpendingOverviewCard: View {
  let spending: DomaSpending
  let range: DomaMonthRange
  let onChooseRange: () -> Void

  private var summary: DomaSpending.Summary { spending.summary }

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      rangeButton
      hero
    }
    .padding(16)
    .frame(maxWidth: .infinity, alignment: .leading)
    .domaCardSurface()
  }

  private var rangeButton: some View {
    Button(action: onChooseRange) {
      HStack(spacing: 8) {
        Image(systemName: "calendar")
          .domaFont(.detailEmphasis)
        Text(SpendingFormat.rangeTitle(range))
          .domaFont(.supportingEmphasis)
        Text("· \(SpendingFormat.monthCount(range.monthCount))")
          .domaFont(.supporting)
          .foregroundStyle(DomaColor.warmTextSecondary)
        Image(systemName: "chevron.down")
          .domaFont(.detailEmphasis)
          .foregroundStyle(DomaColor.warmTextSecondary)
      }
      .foregroundStyle(DomaColor.warmTextPrimary)
      .padding(.leading, 10)
      .padding(.trailing, 12)
      .frame(minHeight: 36)
      .background(DomaColor.warmChip, in: .capsule)
      .frame(minHeight: 44)
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Time range, \(SpendingFormat.rangeTitle(range)), \(SpendingFormat.monthCountLong(range.monthCount))")
    .accessibilityHint("Choose the months to show")
  }

  private var hero: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("Average monthly gain")
        .domaFont(.kicker)
        .tracking(1)
        .textCase(.uppercase)
        .foregroundStyle(DomaColor.warmTextSecondary)
      ViewThatFits(in: .horizontal) {
        HStack(alignment: .firstTextBaseline, spacing: 10) { gainFigure; gainChange }
        VStack(alignment: .leading, spacing: 2) { gainFigure; gainChange }
      }
      .accessibilityElement(children: .combine)
      HStack(alignment: .top, spacing: 0) {
        SpendingFigure(
          label: "Avg income", value: SpendingFormat.money(summary.avgIncome.value),
          change: SpendingChange(summary.avgIncome, kind: .percent))
        divider
        SpendingFigure(
          label: "Avg spend", value: SpendingFormat.money(summary.avgSpend.value),
          change: SpendingChange(summary.avgSpend, kind: .percent, lowerIsBetter: true))
        divider
        SpendingFigure(
          label: "Saved", value: SpendingFormat.percent(basisPoints: summary.savingsRate.value),
          change: SpendingChange(summary.savingsRate, kind: .points))
      }
      .fixedSize(horizontal: false, vertical: true)
      .padding(.top, 12)
    }
  }

  private var gainFigure: some View {
    Text(SpendingFormat.money(summary.avgNet.value))
      .domaFont(.figure)
      .monospacedDigit()
      .foregroundStyle(DomaColor.warmTextPrimary)
      .lineLimit(1)
      .minimumScaleFactor(0.6)
  }

  @ViewBuilder
  private var gainChange: some View {
    if let change = SpendingChange(summary.avgNet, kind: .money), let comparison = summary.comparison {
      Text("\(change.text) vs prior \(SpendingFormat.monthCount(comparison.monthCount))")
        .domaFont(.supportingEmphasis)
        .foregroundStyle(change.tone.color)
        .accessibilityLabel("\(change.spokenText) on the \(SpendingFormat.monthCountLong(comparison.monthCount)) before")
    } else {
      Text("No earlier months to compare")
        .domaFont(.supporting)
        .foregroundStyle(DomaColor.warmTextTertiary)
    }
  }

  private var divider: some View {
    Rectangle()
      .fill(DomaColor.warmBorder)
      .frame(width: 1)
      .padding(.horizontal, 12)
  }
}

/// One of the overview card's three smaller figures.
private struct SpendingFigure: View {
  let label: String
  let value: String
  let change: SpendingChange?

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(label)
        .domaFont(.detail)
        .foregroundStyle(DomaColor.warmTextSecondary)
      Text(value)
        .domaFont(.figureSmall)
        .monospacedDigit()
        .foregroundStyle(DomaColor.warmTextPrimary)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
      if let change {
        Text(change.text)
          .domaFont(.detailEmphasis)
          .foregroundStyle(change.tone.color)
          .accessibilityLabel(change.spokenText)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .accessibilityElement(children: .combine)
  }
}

extension SpendingChange.Tone {
  var color: Color {
    switch self {
    case .good: DomaColor.warmPositiveText
    case .bad: DomaColor.warmNegativeText
    case .neutral: DomaColor.warmTextSecondary
    }
  }
}
