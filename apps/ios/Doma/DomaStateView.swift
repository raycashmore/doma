import SwiftUI

/// Empty, unavailable and failed states. These are different situations, so callers name each one.
struct DomaStateView: View {
  let title: String
  let systemImage: String
  var message: String?

  var body: some View {
    ContentUnavailableView {
      Label {
        Text(title)
          .domaFont(.displaySmall)
          .foregroundStyle(DomaColor.warmTextPrimary)
      } icon: {
        Image(systemName: systemImage)
          .foregroundStyle(DomaColor.warmAccent)
      }
    } description: {
      if let message {
        Text(message)
          .domaFont(.supporting)
          .foregroundStyle(DomaColor.warmTextSecondary)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(DomaColor.warmBgCardSoft.ignoresSafeArea())
  }
}
