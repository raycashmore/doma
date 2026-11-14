import SwiftUI
import Testing
import UIKit

@testable import Doma

@MainActor
struct DomaColorTests {
  /// Every theme role beside the generated token it reads.
  private let roles: [(colour: Color, token: DomaColorPair)] = [
    (DomaColor.warmBgCardSoft, DomaTokens.warmBgCardSoft), (DomaColor.warmBgCard, DomaTokens.warmBgCard),
    (DomaColor.warmBorder, DomaTokens.warmBorder), (DomaColor.warmTextPrimary, DomaTokens.warmTextPrimary),
    (DomaColor.warmTextSecondary, DomaTokens.warmTextSecondary),
    (DomaColor.warmTextTertiary, DomaTokens.warmTextTertiary), (DomaColor.warmAccent, DomaTokens.warmAccent),
    (DomaColor.warmBgDark, DomaTokens.warmBgDark), (DomaColor.warmTextOnDark, DomaTokens.warmTextOnDark),
    (DomaColor.onDarkHighlight, DomaTokens.onDarkHighlight), (DomaColor.checkRing, DomaTokens.checkRing),
    (DomaColor.sheetBackground, DomaTokens.sheetBackground),
  ]

  /// SwiftUI resolves dynamic colours off the main thread during transitions. A main-actor
  /// provider traps there, which closed the app when a sheet was dismissed.
  @Test func everyThemeColourResolvesOffTheMainThread() async {
    let colours = roles.map(\.colour)
    let resolved = await Task.detached {
      colours.flatMap { colour in
        [UIUserInterfaceStyle.light, .dark].map {
          UIColor(colour).resolvedColor(with: UITraitCollection(userInterfaceStyle: $0))
        }
      }
    }.value

    #expect(resolved.count == colours.count * 2)
    // Light and dark differ, so the dynamic provider ran rather than a fixed colour.
    #expect(resolved[0] != resolved[1])
  }

  /// A shared token change reaches the app only if the theme shows the generated value.
  @Test func everyThemeColourShowsItsGeneratedToken() {
    for (colour, token) in roles {
      for (style, hex, alpha) in [
        (UIUserInterfaceStyle.light, token.light, token.lightAlpha), (.dark, token.dark, token.darkAlpha),
      ] {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var shownAlpha: CGFloat = 0
        UIColor(colour).resolvedColor(with: UITraitCollection(userInterfaceStyle: style))
          .getRed(&red, green: &green, blue: &blue, alpha: &shownAlpha)
        #expect(Int((red * 255).rounded()) == Int((hex >> 16) & 0xFF))
        #expect(Int((green * 255).rounded()) == Int((hex >> 8) & 0xFF))
        #expect(Int((blue * 255).rounded()) == Int(hex & 0xFF))
        #expect(abs(shownAlpha - alpha) < 0.001)
      }
    }
  }
}
