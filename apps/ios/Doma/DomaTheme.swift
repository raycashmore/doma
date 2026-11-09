import SwiftUI

enum DomaTheme {
  /// Radius of the sheet's top corners where it meets the dark header.
  static let sheetCornerRadius: CGFloat = 28

  static func applyNavigationBarAppearance() {
    style(UINavigationBar.appearance(), color: UIColor(DomaColor.warmTextPrimary))
    // The Lists screens sit under the dark header; sheets are presented outside the split view.
    style(
      UINavigationBar.appearance(whenContainedInInstancesOf: [UISplitViewController.self]),
      color: UIColor(DomaColor.warmTextOnDark)
    )
  }

  private static func style(_ bar: UINavigationBar, color: UIColor) {
    bar.largeTitleTextAttributes = [
      .font: DomaFont.navigationTitle(size: 34, style: .largeTitle),
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

  /// The dark header: the bar stays clear over the header colour, with light controls in either
  /// appearance. A bar background would resolve the colour in the bar's dark appearance instead.
  func domaDarkHeader() -> some View {
    background(DomaColor.warmBgDark.ignoresSafeArea())
      .toolbarColorScheme(.dark, for: .navigationBar)
  }

  /// The floating capsule at the foot of a screen: Add an Item, or New List.
  func domaBottomCapsule() -> some View {
    padding(.leading, 8)
      .padding(.trailing, 16)
      .frame(minHeight: 52)
      .glassEffect(.regular.tint(DomaColor.warmBgCard.opacity(0.6)).interactive(), in: .capsule)
      .frame(maxWidth: 560)
      .padding(.horizontal, 16)
      .padding(.bottom, 8)
  }

  func domaPrimaryButton() -> some View {
    domaFont(.button)
      .foregroundStyle(DomaColor.warmBgCardSoft)
      .buttonStyle(.borderedProminent)
      .buttonBorderShape(.capsule)
      .controlSize(.large)
      .tint(DomaColor.warmTextPrimary)
  }

  func domaSaveFailureAlert(isPresented: Binding<Bool>) -> some View {
    alert("The change was not saved", isPresented: isPresented) {
      Button("OK", role: .cancel) {}
    }
  }
}

enum DomaSheetCorners {
  case top
  /// iPad, where the sheet meets the sidebar on its leading edge only.
  case topLeading

  var shape: UnevenRoundedRectangle {
    let radius = DomaTheme.sheetCornerRadius
    return switch self {
    case .top: UnevenRoundedRectangle(topLeadingRadius: radius, topTrailingRadius: radius, style: .continuous)
    case .topLeading: UnevenRoundedRectangle(topLeadingRadius: radius, style: .continuous)
    }
  }
}
