import SwiftUI

struct RootView: View {
  let session: DomaSession
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.legibilityWeight) private var legibilityWeight
  @State private var navigationBarRevision = 0

  var body: some View {
    Group {
      switch session.phase {
      case .loading:
        DomaLoadingView()
      case .signedOut:
        SignInView()
      case .signedIn:
        // Navigation bars read their font when created, so a text setting change needs new ones.
        ListsView(session: session)
          .id(navigationBarRevision)
      }
    }
    .onChange(of: dynamicTypeSize) { refreshNavigationBars() }
    .onChange(of: legibilityWeight) { refreshNavigationBars() }
  }

  private func refreshNavigationBars() {
    DomaTheme.applyNavigationBarAppearance()
    navigationBarRevision += 1
  }
}
