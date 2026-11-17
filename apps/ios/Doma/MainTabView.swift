import SwiftUI

enum AppTab: Hashable {
  case home
  case lists
}

/// Home and Lists. iPhone shows the tabs at the foot; iPad at the top, as iPadOS does.
struct MainTabView: View {
  let session: DomaSession
  @Binding var selection: AppTab

  var body: some View {
    TabView(selection: $selection) {
      Tab("Home", systemImage: "house", value: AppTab.home) {
        HomeView(session: session)
      }
      Tab("Lists", systemImage: "checklist", value: AppTab.lists) {
        ListsView(session: session)
      }
    }
    .tint(DomaColor.warmTextPrimary)
    // A widget asks for a list, which Lists opens once it is showing, or for Home.
    .onAppear {
      if session.openRequest.publicId != nil { selection = .lists }
    }
    .onChange(of: session.openRequest.openCount) { selection = .lists }
    .onChange(of: session.homeOpenRequest.openCount) { selection = .home }
  }
}
