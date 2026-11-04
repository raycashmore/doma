import SwiftUI

/// An opaque cover shown while the app is not active.
struct PrivacyCover: View {
  var body: some View {
    DomaColor.warmBgCardSoft
      .ignoresSafeArea()
      .overlay {
        Image(decorative: "HearthMark")
      }
      .accessibilityHidden(true)
  }
}
