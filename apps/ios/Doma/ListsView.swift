import DomaKit
import SwiftUI

struct ListsView: View {
  let session: DomaSession
  @State private var lists: [DomaListSummary]?
  @State private var loadFailed = false
  @State private var selectedListId: DomaListSummary.ID?
  @State private var compactColumn: NavigationSplitViewColumn

  private let lastOpenedList = LastOpenedList()

  init(session: DomaSession) {
    self.session = session
    let restoredId = lastOpenedList.publicId
    _selectedListId = State(initialValue: restoredId)
    _compactColumn = State(initialValue: restoredId == nil ? .sidebar : .detail)
  }

  private var selectedList: DomaListSummary? {
    lists?.first { $0.id == selectedListId }
  }

  var body: some View {
    // A sidebar and detail on iPad; collapses to a navigation stack on iPhone.
    NavigationSplitView(preferredCompactColumn: $compactColumn) {
      sidebar
        .navigationTitle("Lists")
        .toolbar {
          Menu("More", systemImage: "ellipsis") {
            Button("Sign out") {
              Task { await session.signOut() }
            }
          }
        }
    } detail: {
      detail
    }
    .tint(DomaColor.warmTextPrimary)
    .onChange(of: selectedListId) { _, id in
      if let id { lastOpenedList.remember(id) }
    }
    .task {
      do {
        for try await value in session.lists.visibleLists().values {
          if lists == nil { restoreSelection(from: value) }
          lists = value
          loadFailed = false
        }
      } catch {
        loadFailed = true
      }
    }
  }

  @ViewBuilder
  private var sidebar: some View {
    if let lists {
      ListsSidebar(lists: lists, selectedListId: $selectedListId)
    } else if loadFailed {
      DomaStateView(title: "Lists are unavailable", systemImage: "exclamationmark.triangle")
    } else {
      DomaLoadingView(message: "Loading lists...")
    }
  }

  @ViewBuilder
  private var detail: some View {
    if let selectedList {
      ListDetailView(lists: session.lists, list: selectedList)
        .id(selectedList.id)
    } else if lists == nil {
      if loadFailed {
        DomaStateView(title: "Lists are unavailable", systemImage: "exclamationmark.triangle")
      } else {
        DomaLoadingView(message: "Loading lists...")
      }
    } else if selectedListId != nil {
      DomaStateView(title: "This list is unavailable", systemImage: "lock")
    } else {
      DomaStateView(title: "Choose a list", systemImage: "checklist")
    }
  }

  /// A list that disappears while open stays selected, so the detail can say it is unavailable.
  /// Only a stale list from a previous launch is dropped here.
  private func restoreSelection(from visibleLists: [DomaListSummary]) {
    guard selectedListId != nil else { return }
    selectedListId = lastOpenedList.restorableId(among: visibleLists.map(\.id))
    if selectedListId == nil {
      lastOpenedList.forget()
      compactColumn = .sidebar
    }
  }
}
