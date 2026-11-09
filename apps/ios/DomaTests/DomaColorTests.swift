import SwiftUI
import Testing
import UIKit

@testable import Doma

@MainActor
struct DomaColorTests {
  /// SwiftUI resolves dynamic colours off the main thread during transitions. A main-actor
  /// provider traps there, which closed the app when a sheet was dismissed.
  @Test func everyThemeColourResolvesOffTheMainThread() async {
    let colours = [
      DomaColor.warmBgCardSoft, DomaColor.warmBgCard, DomaColor.warmBorder, DomaColor.warmTextPrimary,
      DomaColor.warmTextSecondary, DomaColor.warmTextTertiary, DomaColor.warmAccent, DomaColor.warmBgDark,
      DomaColor.warmTextOnDark, DomaColor.onDarkHighlight, DomaColor.checkRing, DomaColor.sheetBackground,
    ]
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
}
