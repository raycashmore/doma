import DomaKit
import SwiftUI

/// Stands in for the month detail sheet (RAY-312): the month's net and totals.
struct SpendingMonthPlaceholderSheet: View {
  let month: DomaSpending.Month
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    NavigationStack {
      VStack(alignment: .leading, spacing: 8) {
        Text(SpendingFormat.signedMoney(month.net))
          .domaFont(.figure)
          .monospacedDigit()
          .foregroundStyle(month.net < 0 ? DomaColor.warmNegativeText : DomaColor.warmPositiveText)
        Text("In \(SpendingFormat.money(month.income)) · Out \(SpendingFormat.money(month.spend))")
          .domaFont(.supporting)
          .monospacedDigit()
          .foregroundStyle(DomaColor.warmTextSecondary)
        Text("The month's income, categories and mortgage are coming soon.")
          .domaFont(.supporting)
          .foregroundStyle(DomaColor.warmTextTertiary)
          .padding(.top, 12)
      }
      .padding(20)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      .background(DomaColor.sheetBackground.ignoresSafeArea())
      .navigationTitle(SpendingFormat.longMonthYear(month.month))
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          Button("Done") { dismiss() }
        }
      }
    }
    .presentationDetents([.medium])
  }
}
