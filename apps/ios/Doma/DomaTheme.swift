import SwiftUI

enum DomaTheme {
  static func applyNavigationBarAppearance() {
    let bar = UINavigationBar.appearance()
    let color = UIColor(DomaColor.warmTextPrimary)
    bar.largeTitleTextAttributes = [
      .font: DomaFont.navigationTitle(size: 32, style: .largeTitle),
      .foregroundColor: color,
    ]
    bar.titleTextAttributes = [
      .font: DomaFont.navigationTitle(size: 17, style: .headline),
      .foregroundColor: color,
    ]
  }
}

extension View {
  /// Warm paper behind a screen, including lists that would otherwise draw the system background.
  func domaScreenBackground() -> some View {
    scrollContentBackground(.hidden)
      .background(DomaColor.warmBgCardSoft.ignoresSafeArea())
  }

  func domaPrimaryButton() -> some View {
    domaFont(.button)
      .foregroundStyle(DomaColor.warmBgCardSoft)
      .buttonStyle(.borderedProminent)
      .buttonBorderShape(.capsule)
      .controlSize(.large)
      .tint(DomaColor.warmTextPrimary)
  }
}
