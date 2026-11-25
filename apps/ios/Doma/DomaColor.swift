import SwiftUI

/// The theme's colour roles. Values come from `DomaTokens`, generated from `packages/tokens`
/// (`pnpm --filter @repo/tokens generate`); this file only names what each role is for.
enum DomaColor {
  /// The sheet that holds a screen's content.
  static let warmBgCardSoft = color(DomaTokens.warmBgCardSoft)
  /// Cards and capsules raised off the sheet.
  static let warmBgCard = color(DomaTokens.warmBgCard)
  static let warmBorder = color(DomaTokens.warmBorder)
  static let warmTextPrimary = color(DomaTokens.warmTextPrimary)
  static let warmTextSecondary = color(DomaTokens.warmTextSecondary)
  static let warmTextTertiary = color(DomaTokens.warmTextTertiary)
  static let warmAccent = color(DomaTokens.warmAccent)
  /// The dark header above the sheet, dark in both appearances, as on the web.
  static let warmBgDark = color(DomaTokens.warmBgDark)
  /// Text and highlights on `warmBgDark`.
  static let warmTextOnDark = color(DomaTokens.warmTextOnDark)
  static let onDarkHighlight = color(DomaTokens.onDarkHighlight)
  /// The unticked checkbox ring.
  static let checkRing = color(DomaTokens.checkRing)
  /// Behind the item sheet's cards.
  static let sheetBackground = color(DomaTokens.sheetBackground)
  /// Gains and changes for the better; coral (`warmAccent`) marks losses.
  static let warmPositive = color(DomaTokens.warmPositive)
  /// Gains and losses as text or small fills, where `warmPositive` and coral fall short of 4.5:1
  /// on a card in light mode.
  static let warmPositiveText = color(DomaTokens.warmPositiveText)
  static let warmNegativeText = color(DomaTokens.warmNegativeText)
  /// Behind months inside a chosen range, with `warmPositiveOnSoft` text.
  static let warmPositiveSoft = color(DomaTokens.warmPositiveSoft)
  static let warmPositiveOnSoft = color(DomaTokens.warmPositiveOnSoft)
  /// A quiet filled control on a card, such as the Spending range button.
  static let warmChip = color(DomaTokens.warmChip)
  /// System red, which keeps its contrast for small text where coral does not.
  static let destructive = Color.red

  /// Nonisolated: SwiftUI can resolve a dynamic colour off the main thread while it renders a
  /// transition, and a main-actor closure traps there (seen when a sheet closed).
  private nonisolated static func color(_ pair: DomaColorPair) -> Color {
    Color(uiColor: UIColor {
      $0.userInterfaceStyle == .dark
        ? uiColor(pair.dark, alpha: pair.darkAlpha) : uiColor(pair.light, alpha: pair.lightAlpha)
    })
  }

  private nonisolated static func uiColor(_ hex: UInt32, alpha: Double) -> UIColor {
    UIColor(
      red: CGFloat((hex >> 16) & 0xFF) / 255,
      green: CGFloat((hex >> 8) & 0xFF) / 255,
      blue: CGFloat(hex & 0xFF) / 255,
      alpha: alpha
    )
  }
}
