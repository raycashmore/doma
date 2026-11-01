import SwiftUI

struct RootView: View {
  let session: DomaSession

  var body: some View {
    switch session.phase {
    case .loading:
      ProgressView()
    case .signedOut:
      SignInView()
    case .signedIn:
      ListsView(session: session)
    }
  }
}
