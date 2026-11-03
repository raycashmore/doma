import SwiftUI

/// An opaque cover shown while the app is not active.
struct PrivacyCover: View {
  var body: some View {
    Rectangle()
      .fill(.background)
      .ignoresSafeArea()
      .overlay {
        Text("Doma")
          .font(.largeTitle.bold())
          .foregroundStyle(.secondary)
      }
      .accessibilityHidden(true)
  }
}
