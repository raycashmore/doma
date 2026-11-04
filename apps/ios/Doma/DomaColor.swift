import SwiftUI

/// Hand-written until generated Swift tokens replace it. Names follow `packages/tokens`;
/// light values come from there, and dark values are iOS-only because the tokens have no warm dark palette.
enum DomaColor {
  static let warmBgCardSoft = color(light: 0xFFF8EE, dark: 0x1F1A15)
  static let warmBgCard = color(light: 0xFFFCF6, dark: 0x2B241D)
  static let warmBorder = color(light: 0xEFE3D2, dark: 0x3D3328)
  static let warmSectionMortgage = color(light: 0xF2E4C9, dark: 0x3D3328)
  static let warmTextPrimary = color(light: 0x3D2E22, dark: 0xF6EDE0)
  static let warmTextSecondary = color(light: 0x7C6755, dark: 0xBCAB97)
  static let warmAccent = color(light: 0xD85A36, dark: 0xF4744A)

  private static func color(light: UInt32, dark: UInt32) -> Color {
    Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? uiColor(dark) : uiColor(light) })
  }

  private static func uiColor(_ hex: UInt32) -> UIColor {
    UIColor(
      red: CGFloat((hex >> 16) & 0xFF) / 255,
      green: CGFloat((hex >> 8) & 0xFF) / 255,
      blue: CGFloat(hex & 0xFF) / 255,
      alpha: 1
    )
  }
}
