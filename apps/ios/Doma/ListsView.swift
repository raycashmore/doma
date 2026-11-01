import DomaKit
import SwiftUI

struct ListsView: View {
  let session: DomaSession
  @State private var lists: [DomaListSummary]?
  @State private var loadFailed = false

  var body: some View {
    NavigationStack {
      Group {
        if let lists {
          List(lists) { list in
            NavigationLink(value: list) {
              Label(list.name, systemImage: list.visibility == .shared ? "person.2" : "person")
            }
          }
          .overlay {
            if lists.isEmpty {
              ContentUnavailableView("No lists yet", systemImage: "checklist")
            }
          }
        } else if loadFailed {
          ContentUnavailableView("Lists are unavailable", systemImage: "exclamationmark.triangle")
        } else {
          ProgressView()
        }
      }
      .navigationTitle("Lists")
      .navigationDestination(for: DomaListSummary.self) { list in
        ListDetailView(lists: session.lists, list: list)
      }
      .toolbar {
        Button("Sign out") {
          Task { await session.signOut() }
        }
      }
    }
    .task {
      do {
        for try await value in session.lists.visibleLists().values {
          lists = value
          loadFailed = false
        }
      } catch {
        loadFailed = true
      }
    }
  }
}
