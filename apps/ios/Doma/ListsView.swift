import DomaKit
import SwiftUI

struct ListsView: View {
  let session: DomaSession
  @State private var lists: [DomaListSummary]?
  @State private var loadFailed = false
  @State private var selectedListId: DomaListSummary.ID?
  @State private var compactColumn: NavigationSplitViewColumn
  @State private var defaultListId: DomaListSummary.ID?
  @State private var isCreatingList = false
  @State private var listCreatedInSheet: DomaListSummary.ID?
  @State private var createdListId: DomaListSummary.ID?
  @State private var deleteFailed = false
  @State private var openItems: DomaListItems?
  @State private var unavailableListId: DomaListSummary.ID?

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
          Button("New List", systemImage: "plus") { isCreatingList = true }
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
    .sheet(isPresented: $isCreatingList, onDismiss: openListCreatedInSheet) {
      NewListSheet(lists: session.lists) { id in
        // A save can outlive its sheet, and then no dismissal is left to open the list.
        if isCreatingList {
          listCreatedInSheet = id
        } else {
          createdListId = id
          openCreatedList()
        }
      }
    }
    .domaSaveFailureAlert(isPresented: $deleteFailed)
    .onChange(of: selectedListId) { _, id in
      if let id { lastOpenedList.remember(id) }
    }
    // Here, not in the detail view: on iPhone, opening a new list can cancel the detail's `.task`
    // or skip its `onAppear` while the screen stays up, which leaves its spinner there for good.
    .task(id: selectedListId) { await watchOpenList() }
    .task {
      do {
        for try await value in session.lists.visibleLists().values {
          if lists == nil { restoreSelection(from: value) }
          lists = value
          loadFailed = false
          openCreatedList()
        }
      } catch {
        loadFailed = true
      }
    }
    .task {
      do {
        for try await value in session.lists.defaultList().values {
          defaultListId = value?.publicId
        }
      } catch {
        defaultListId = nil
      }
    }
  }

  @ViewBuilder
  private var sidebar: some View {
    if let lists {
      ListsSidebar(lists: lists, defaultListId: defaultListId, selectedListId: $selectedListId)
    } else if loadFailed {
      DomaStateView(title: "Lists are unavailable", systemImage: "exclamationmark.triangle")
    } else {
      DomaLoadingView(message: "Loading lists...")
    }
  }

  @ViewBuilder
  private var detail: some View {
    if let selectedList {
      ListDetailView(
        lists: session.lists,
        list: selectedList,
        // A frame can pass between selecting a list and its items loading.
        items: openItems?.list.id == selectedList.id ? openItems : nil,
        isUnavailable: unavailableListId == selectedList.id,
        isDefault: selectedList.id == defaultListId
      ) {
        await delete(selectedList)
      }
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

  private func watchOpenList() async {
    openItems = nil
    unavailableListId = nil
    guard let selectedListId else { return }
    do {
      for try await value in session.lists.items(listPublicId: selectedListId).values {
        openItems = value
        unavailableListId = value == nil ? selectedListId : nil
      }
    } catch {
      unavailableListId = selectedListId
    }
  }

  /// Waits for the sheet to go, because navigating while it closes can leave a screen that never updates.
  private func openListCreatedInSheet() {
    createdListId = listCreatedInSheet
    listCreatedInSheet = nil
    openCreatedList()
  }

  /// A new list can reach this device after its mutation returns, so opening waits until it is visible.
  private func openCreatedList() {
    guard let createdListId, lists?.contains(where: { $0.id == createdListId }) == true else { return }
    selectedListId = createdListId
    compactColumn = .detail
    self.createdListId = nil
  }

  /// Leaves the list first, so the live update does not show it as unavailable while it closes.
  private func delete(_ list: DomaListSummary) async {
    selectedListId = nil
    compactColumn = .sidebar
    do {
      try await session.lists.deleteList(publicId: list.id)
      if lastOpenedList.publicId == list.id { lastOpenedList.forget() }
    } catch {
      deleteFailed = true
      // Someone who has opened another list meanwhile stays there.
      if selectedListId == nil {
        selectedListId = list.id
        compactColumn = .detail
      }
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
