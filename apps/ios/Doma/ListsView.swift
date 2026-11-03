import DomaKit
import SwiftUI

struct ListsView: View {
  let session: DomaSession
  @State private var lists: [DomaListSummary]?
  @State private var loadFailed = false
  @State private var selectedListId: DomaListSummary.ID?

  private var selectedList: DomaListSummary? {
    lists?.first { $0.id == selectedListId }
  }

  var body: some View {
    // A sidebar and detail on iPad; collapses to a navigation stack on iPhone.
    NavigationSplitView {
      Group {
        if let lists {
          List(lists, selection: $selectedListId) { list in
            NavigationLink(value: list.id) {
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
      .toolbar {
        Button("Sign out") {
          Task { await session.signOut() }
        }
      }
    } detail: {
      if let selectedList {
        ListDetailView(lists: session.lists, list: selectedList)
          .id(selectedList.id)
      } else if selectedListId != nil {
        ContentUnavailableView("This list is unavailable", systemImage: "lock")
      } else {
        ContentUnavailableView("Choose a list", systemImage: "checklist")
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
