import DomaKit
import SwiftUI

/// One year's months for exact picks: tap a start month, then an end month. It opens on the year
/// the range ends in, and follows the range when the chips or the strip change it.
struct SpendingMonthGrid: View {
  let available: DomaMonthRange
  @Binding var range: DomaMonthRange
  @State private var year: Int
  /// The first tap's month, until the second tap picks the end.
  @State private var pendingStart: DomaMonth?
  /// The range this grid last set, so its own picks do not move the year.
  @State private var lastPicked: DomaMonthRange?
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  /// Months per row: six fit at most sizes, four keep names whole at accessibility sizes.
  private var columns: Int { dynamicTypeSize.isAccessibilitySize ? 4 : 6 }

  init(available: DomaMonthRange, range: Binding<DomaMonthRange>) {
    self.available = available
    _range = range
    _year = State(initialValue: range.wrappedValue.to.year)
  }

  var body: some View {
    VStack(spacing: 12) {
      HStack {
        yearButton("Previous year", systemImage: "chevron.left", to: year - 1)
        Spacer()
        Text(String(year))
          .domaFont(.sectionHeader)
          .monospacedDigit()
          .foregroundStyle(DomaColor.warmTextPrimary)
          .accessibilityAddTraits(.isHeader)
        Spacer()
        yearButton("Next year", systemImage: "chevron.right", to: year + 1)
      }
      Grid(horizontalSpacing: 0, verticalSpacing: 8) {
        ForEach(Array(stride(from: 1, through: 12, by: columns)), id: \.self) { firstMonth in
          GridRow {
            ForEach(firstMonth..<(firstMonth + columns), id: \.self) { monthNumber in
              cell(DomaMonth(year: year, month: monthNumber), rowStart: firstMonth, rowEnd: firstMonth + columns - 1)
            }
          }
        }
      }
      Text(pendingStart == nil ? "Tap a start month, then an end month" : "Now tap an end month")
        .domaFont(.detail)
        .foregroundStyle(DomaColor.warmTextTertiary)
    }
    .onChange(of: range) { _, newRange in
      guard newRange != lastPicked else { return }
      pendingStart = nil
      year = newRange.to.year
    }
  }

  private func yearButton(_ label: String, systemImage: String, to target: Int) -> some View {
    Button(label, systemImage: systemImage) { year = target }
      .labelStyle(.iconOnly)
      .domaFont(.sectionHeader)
      .frame(minWidth: 44, minHeight: 44)
      .contentShape(.rect)
      .disabled(target < available.from.year || target > available.to.year)
      .foregroundStyle(DomaColor.warmTextPrimary)
  }

  private func cell(_ month: DomaMonth, rowStart: Int, rowEnd: Int) -> some View {
    let isEnd = month == range.from || month == range.to
    let isInside = range.contains(month)
    let isAvailable = available.contains(month)
    let leading: CGFloat = isInside && (month == range.from || month.month == rowStart) ? 20 : 0
    let trailing: CGFloat = isInside && (month == range.to || month.month == rowEnd) ? 20 : 0
    return Button { pick(month) } label: {
      Text(SpendingFormat.shortMonth(month))
        .domaFont(isEnd ? .supportingEmphasis : .supporting)
        .foregroundStyle(
          isEnd ? DomaColor.warmBgCard
            : isInside ? DomaColor.warmPositiveOnSoft
            : isAvailable ? DomaColor.warmTextPrimary : DomaColor.checkRing)
        .frame(maxWidth: .infinity, minHeight: 44)
        .background {
          if isInside {
            UnevenRoundedRectangle(
              topLeadingRadius: leading, bottomLeadingRadius: leading, bottomTrailingRadius: trailing,
              topTrailingRadius: trailing
            )
            .fill(isEnd ? DomaColor.warmPositiveText : DomaColor.warmPositiveSoft)
          }
        }
        .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .disabled(!isAvailable)
    .accessibilityLabel(SpendingFormat.longMonthYear(month))
    .accessibilityAddTraits(isInside ? .isSelected : [])
  }

  private func pick(_ month: DomaMonth) {
    let picked: DomaMonthRange?
    if let start = pendingStart {
      picked = DomaMonthRange(from: min(start, month), to: max(start, month))
      pendingStart = nil
    } else {
      picked = DomaMonthRange(from: month, to: month)
      pendingStart = month
    }
    guard let picked else { return }
    lastPicked = picked
    range = picked
  }
}
