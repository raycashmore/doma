import DomaKit
import SwiftUI

/// The chip that shows the chosen months and opens the Time range sheet.
struct SpendingRangeButton: View {
  let range: DomaMonthRange
  /// The overview card adds the month count; the full-screen chart has room only for the months.
  var showsCount = true
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack(spacing: 8) {
        Image(systemName: "calendar")
          .domaFont(.detailEmphasis)
        Text(SpendingFormat.rangeTitle(range))
          .domaFont(.supportingEmphasis)
        if showsCount {
          Text("· \(SpendingFormat.monthCount(range.monthCount))")
            .domaFont(.supporting)
            .foregroundStyle(DomaColor.warmTextSecondary)
        }
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
}
