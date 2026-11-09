import SwiftUI

/// Hand-written until generated Swift tokens replace it. Names follow `packages/tokens` where a token
/// exists; dark values are iOS-only because the tokens have no warm dark palette. RAY-275 records them.
enum DomaColor {
  /// The sheet that holds a screen's content.
  static let warmBgCardSoft = color(light: 0xFFFCF6, dark: 0x1F1A15)
  /// Cards and capsules raised off the sheet.
  static let warmBgCard = color(light: 0xFFFFFF, dark: 0x2B241D)
  static let warmBorder = color(light: 0xEFE3D2, dark: 0x3D3328)
  static let warmTextPrimary = color(light: 0x3D2E22, dark: 0xF6EDE0)
  static let warmTextSecondary = color(light: 0x7C6755, dark: 0xBCAB97)
  static let warmTextTertiary = color(light: 0xA8A29E, dark: 0x8A7B6B)
  static let warmAccent = color(light: 0xD85A36, dark: 0xF4744A)
  /// The dark header above the sheet, dark in both appearances, as on the web.
  static let warmBgDark = color(light: 0x2D2D2D, dark: 0x0D0B09)
  /// Text and highlights on `warmBgDark`.
  static let warmTextOnDark = color(light: 0xFAF9F7, dark: 0xF6EDE0)
  static let onDarkHighlight = color(light: 0xFFFFFF, dark: 0xFFFFFF, alpha: 0.12, darkAlpha: 0.08)
  /// The unticked checkbox ring.
  static let checkRing = color(light: 0xC9BBA8, dark: 0x6B5D4F)
  /// Behind the item sheet's cards.
  static let sheetBackground = color(light: 0xFAF6EF, dark: 0x181410)
  /// System red, which keeps its contrast for small text where coral does not.
  static let destructive = Color.red

  /// Nonisolated: SwiftUI can resolve a dynamic colour off the main thread while it renders a
  /// transition, and a main-actor closure traps there (seen when a sheet closed).
  private nonisolated static func color(
    light: UInt32, dark: UInt32, alpha: CGFloat = 1, darkAlpha: CGFloat? = nil
  ) -> Color {
    Color(uiColor: UIColor {
      $0.userInterfaceStyle == .dark ? uiColor(dark, alpha: darkAlpha ?? alpha) : uiColor(light, alpha: alpha)
    })
  }

  private nonisolated static func uiColor(_ hex: UInt32, alpha: CGFloat) -> UIColor {
    UIColor(
      red: CGFloat((hex >> 16) & 0xFF) / 255,
      green: CGFloat((hex >> 8) & 0xFF) / 255,
      blue: CGFloat(hex & 0xFF) / 255,
      alpha: alpha
    )
  }
}
