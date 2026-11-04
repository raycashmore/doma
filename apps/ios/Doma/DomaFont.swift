import SwiftUI

/// Bundled fonts do not respond to Dynamic Type or Bold Text by themselves, so each style names
/// the system style it scales with and the heavier face used when Bold Text is on.
enum DomaFont {
  case body
  case rowTitle
  case supporting
  case sectionHeader
  case count
  case button
  case display
  case displaySmall

  private struct Face {
    let name: String
    let boldName: String
    let size: CGFloat
    let textStyle: Font.TextStyle
  }

  private static let merriweatherBold = "MerriweatherLight18pt-Bold"
  private static let merriweatherExtraBold = "MerriweatherLight18pt-ExtraBold"

  private var face: Face {
    switch self {
    case .body: Face(name: "DMSans-Regular", boldName: "DMSans-SemiBold", size: 17, textStyle: .body)
    case .rowTitle: Face(name: "DMSans-Medium", boldName: "DMSans-Bold", size: 17, textStyle: .body)
    case .supporting: Face(name: "DMSans-Regular", boldName: "DMSans-SemiBold", size: 15, textStyle: .subheadline)
    case .sectionHeader: Face(name: "DMSans-SemiBold", boldName: "DMSans-Bold", size: 15, textStyle: .subheadline)
    case .count: Face(name: "DMSans-SemiBold", boldName: "DMSans-Bold", size: 12, textStyle: .caption)
    case .button: Face(name: "DMSans-SemiBold", boldName: "DMSans-Bold", size: 17, textStyle: .headline)
    case .display:
      Face(name: Self.merriweatherBold, boldName: Self.merriweatherExtraBold, size: 34, textStyle: .largeTitle)
    case .displaySmall:
      Face(name: Self.merriweatherBold, boldName: Self.merriweatherExtraBold, size: 26, textStyle: .title)
    }
  }

  func font(bold: Bool) -> Font {
    .custom(bold ? face.boldName : face.name, size: face.size, relativeTo: face.textStyle)
  }

  /// Navigation bars take UIKit fonts, set once at launch rather than per view.
  static func navigationTitle(size: CGFloat, style: UIFont.TextStyle) -> UIFont {
    let name = UIAccessibility.isBoldTextEnabled ? merriweatherExtraBold : merriweatherBold
    guard let font = UIFont(name: name, size: size) else { return .preferredFont(forTextStyle: style) }
    return UIFontMetrics(forTextStyle: style).scaledFont(for: font)
  }
}

private struct DomaFontModifier: ViewModifier {
  let style: DomaFont
  @Environment(\.legibilityWeight) private var legibilityWeight

  func body(content: Content) -> some View {
    content.font(style.font(bold: legibilityWeight == .bold))
  }
}

extension View {
  func domaFont(_ style: DomaFont) -> some View {
    modifier(DomaFontModifier(style: style))
  }
}
