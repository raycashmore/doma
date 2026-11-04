import SwiftUI

struct LockedView: View {
  let lock: AppLockController

  var body: some View {
    VStack(spacing: 12) {
      Image(systemName: "lock.fill")
        .font(.largeTitle)
        .foregroundStyle(DomaColor.warmAccent)
        .accessibilityHidden(true)
      Text("Doma is locked")
        .domaFont(.displaySmall)
        .foregroundStyle(DomaColor.warmTextPrimary)
      Text("Use Face ID to continue.")
        .domaFont(.supporting)
        .foregroundStyle(DomaColor.warmTextSecondary)
      Button {
        Task { await lock.unlock() }
      } label: {
        Text("Unlock")
          .frame(maxWidth: .infinity)
      }
      .domaPrimaryButton()
      .disabled(lock.isAuthenticating)
      .padding(.top, 16)
    }
    .padding(32)
    .frame(maxWidth: 480)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(DomaColor.warmBgCardSoft.ignoresSafeArea())
  }
}
