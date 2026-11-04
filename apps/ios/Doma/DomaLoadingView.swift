import SwiftUI

struct DomaLoadingView: View {
  var message: String?

  var body: some View {
    VStack(spacing: 12) {
      ProgressView()
        .tint(DomaColor.warmAccent)
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
