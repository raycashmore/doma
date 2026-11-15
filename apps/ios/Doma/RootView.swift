import SwiftUI

struct RootView: View {
  let session: DomaSession
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.legibilityWeight) private var legibilityWeight
  @State private var navigationBarRevision = 0
  @State private var refreshHold = NavigationBarRefreshHold()
  /// Here, so rebuilding the navigation bars below keeps the open tab.
  @State private var tab = AppTab.home

  var body: some View {
    Group {
      switch session.phase {
      case .loading:
        DomaLoadingView()
      case .signedOut:
        SignInView()
      case .signedIn:
        // Navigation bars read their font when created, so a text setting change needs new ones.
        MainTabView(session: session, selection: $tab)
          .id(navigationBarRevision)
          .environment(refreshHold)
      }
    }
    .onChange(of: dynamicTypeSize) { refreshNavigationBars() }
    .onChange(of: legibilityWeight) { refreshNavigationBars() }
    .onChange(of: refreshHold.isHeld) { _, isHeld in
      if !isHeld && refreshHold.isRefreshPending { refreshNavigationBars() }
    }
  }

  private func refreshNavigationBars() {
    DomaTheme.applyNavigationBarAppearance()
    if refreshHold.requestRefresh() { navigationBarRevision += 1 }
  }
}
