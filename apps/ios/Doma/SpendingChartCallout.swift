import SwiftUI

/// One month's figures over the chart: the net, then the rows that add up to it, and Open month.
struct SpendingChartCallout: View {
  let reading: SpendingChartReading
  let onOpen: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(reading.title)
          .domaFont(.sectionHeader)
          .foregroundStyle(DomaColor.warmTextPrimary)
          .frame(maxWidth: .infinity, alignment: .leading)
        Text(SpendingFormat.signedMoney(reading.net))
          .domaFont(.amount)
          .monospacedDigit()
          .foregroundStyle(reading.net < 0 ? DomaColor.warmNegativeText : DomaColor.warmPositiveText)
      }
      .accessibilityElement(children: .combine)
      VStack(spacing: 4) {
        row("Income", color: SpendingChartSeries.income.color, amount: reading.income)
        row("Spend", color: SpendingChartSeries.spend.color, amount: reading.spend)
        if reading.shared != 0 {
          row("Shared", color: DomaColor.warmTextTertiary, amount: reading.shared)
        }
        row("Mortgage", color: SpendingChartSeries.mortgage.color, amount: reading.mortgage)
      }
      Rectangle().fill(DomaColor.warmBorder).frame(height: 1)
      Button(action: onOpen) {
        HStack {
          Text("Open month")
          Spacer(minLength: 8)
          Image(systemName: "chevron.right")
        }
        .domaFont(.supportingEmphasis)
        .foregroundStyle(DomaColor.warmNegativeText)
        .frame(minHeight: 44)
        .contentShape(.rect)
      }
      .buttonStyle(.plain)
      .accessibilityLabel("Open \(reading.title)")
    }
    .padding(.horizontal, 14)
    .padding(.top, 12)
    .background(DomaColor.warmBgCard, in: .rect(cornerRadius: 16))
    .overlay { RoundedRectangle(cornerRadius: 16).strokeBorder(DomaColor.warmBorder) }
    .shadow(color: .black.opacity(0.08), radius: 12, y: 4)
  }

  private func row(_ title: String, color: Color, amount: Int) -> some View {
    HStack(spacing: 8) {
      RoundedRectangle(cornerRadius: 2)
        .fill(color)
        .frame(width: 9, height: 9)
        .accessibilityHidden(true)
      Text(title)
        .foregroundStyle(DomaColor.warmTextSecondary)
      Spacer(minLength: 8)
      Text(SpendingFormat.money(amount))
        .monospacedDigit()
        .foregroundStyle(DomaColor.warmTextPrimary)
    }
    .domaFont(.supporting)
    .accessibilityElement(children: .combine)
  }
}
