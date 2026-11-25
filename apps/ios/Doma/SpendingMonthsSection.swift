import DomaKit
import SwiftUI

/// The range's months, newest first, each with its income, spend and net.
struct SpendingMonthsSection: View {
  /// Oldest first, as the server sends them.
  let months: [DomaSpending.Month]
  let onOpen: (DomaSpending.Month) -> Void

  /// Names carry the year only when the months span more than one.
  private var showsYear: Bool { Set(months.map(\.month.year)).count > 1 }

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .firstTextBaseline) {
        Text("Months")
          .domaFont(.sectionHeader)
          .foregroundStyle(DomaColor.warmTextPrimary)
          .accessibilityAddTraits(.isHeader)
        Spacer(minLength: 8)
        Text("Net after spending")
          .domaFont(.detail)
          .foregroundStyle(DomaColor.warmTextTertiary)
      }
      .padding(.horizontal, 4)
      .padding(.top, 8)

      if months.isEmpty {
        Text("No figures for these months.")
          .domaFont(.supporting)
          .foregroundStyle(DomaColor.warmTextSecondary)
          .padding(16)
          .frame(maxWidth: .infinity, alignment: .leading)
          .domaCardSurface()
      } else {
        VStack(spacing: 0) {
          ForEach(Array(months.reversed().enumerated()), id: \.element.id) { index, month in
            if index > 0 {
              Rectangle().fill(DomaColor.warmBorder).frame(height: 1).padding(.leading, 16)
            }
            Button { onOpen(month) } label: {
              SpendingMonthRow(month: month, showsYear: showsYear)
            }
            .buttonStyle(.plain)
          }
        }
        .domaCardSurface()
      }
    }
  }
}

private struct SpendingMonthRow: View {
  let month: DomaSpending.Month
  let showsYear: Bool

  private var name: String {
    showsYear ? SpendingFormat.longMonthYear(month.month) : SpendingFormat.longMonth(month.month)
  }

  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  var body: some View {
    HStack(spacing: 12) {
      // At accessibility sizes the net moves under the totals rather than wrapping beside them.
      if dynamicTypeSize.isAccessibilitySize {
        VStack(alignment: .leading, spacing: 2) { title; totals; net }
          .frame(maxWidth: .infinity, alignment: .leading)
      } else {
        VStack(alignment: .leading, spacing: 2) { title; totals }
          .frame(maxWidth: .infinity, alignment: .leading)
        net
      }
      Image(systemName: "chevron.right")
        .domaFont(.detail)
        .foregroundStyle(DomaColor.warmTextTertiary)
        .accessibilityHidden(true)
    }
    .padding(.leading, 16)
    .padding(.trailing, 16)
    .padding(.vertical, 12)
    .frame(minHeight: 60)
    .contentShape(.rect)
    .accessibilityElement(children: .combine)
    .accessibilityHint("Opens the month")
  }

  private var title: some View {
    Text(name)
      .domaFont(.rowTitle)
      .foregroundStyle(DomaColor.warmTextPrimary)
  }

  private var totals: some View {
    Text("In \(SpendingFormat.money(month.income)) · Out \(SpendingFormat.money(month.spend))")
      .domaFont(.detail)
      .monospacedDigit()
      .foregroundStyle(DomaColor.warmTextSecondary)
  }

  private var net: some View {
    Text(SpendingFormat.signedMoney(month.net))
      .domaFont(.amount)
      .monospacedDigit()
      .foregroundStyle(month.net < 0 ? DomaColor.warmNegativeText : DomaColor.warmPositiveText)
      .lineLimit(1)
  }
}
