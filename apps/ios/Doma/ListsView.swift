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
  @State private var openGrouping: OpenGrouping?
  @State private var unavailableListId: DomaListSummary.ID?
  /// Shared first, unless the list being reopened is personal.
  @State private var visibility = DomaListSummary.Visibility.shared
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

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
    .environment(\.isSplitLayout, isSplit)
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
    .task(id: selectedListId) { await watchOpenGrouping() }
    .task {
      await followLiveQuery("Visible lists", subscribe: session.lists.visibleLists) {
        loadFailed = true
      } onValue: { value in
        if lists == nil { restoreSelection(from: value) }
        lists = value
        loadFailed = false
        openCreatedList()
        openRequestedList()
      }
    }
    .onChange(of: session.openRequest.publicId) { openRequestedList() }
    .task {
      await followLiveQuery("Default list", subscribe: session.lists.defaultList) {
        defaultListId = nil
      } onValue: { defaultListId = $0?.publicId }
    }
  }

  private var isSplit: Bool { horizontalSizeClass == .regular }

  @ViewBuilder
  private var sidebar: some View {
    if isSplit {
      // Dark in either appearance, so its content takes the dark palette over the header colour.
      VStack(alignment: .leading, spacing: 0) {
        Text("Lists")
          .domaFont(.display)
          .foregroundStyle(DomaColor.warmTextOnDark)
          .accessibilityAddTraits(.isHeader)
          .padding(.horizontal, 20)
        sidebarContent
          .scrollContentBackground(.hidden)
          .environment(\.colorScheme, .dark)
          // Rows scroll under the title otherwise.
          .clipped()
      }
      .toolbarTitleDisplayMode(.inline)
      .toolbar(removing: .title)
      .domaDarkHeader()
    } else {
      sidebarContent
        .domaHeaderedSheet(title: Text("Lists"))
    }
  }

  @ViewBuilder
  private var sidebarContent: some View {
    if let lists {
      ListsSidebar(
        lists: lists,
        visibility: $visibility,
        selectedListId: $selectedListId,
        isSidebar: isSplit
      ) { isCreatingList = true }
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
        // A frame can pass between selecting a list and its items loading. Waiting for the
        // grouping too stops a grouped list showing in manual order first.
        items: openItems?.list.id == selectedList.id && openGrouping?.listId == selectedList.id ? openItems : nil,
        savedGroupingId: openGrouping?.propertyId,
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
    await followLiveQuery("List items", subscribe: { session.lists.items(listPublicId: selectedListId) }) {
      unavailableListId = selectedListId
    } onValue: { value in
      openItems = value
      unavailableListId = value == nil ? selectedListId : nil
    }
  }

  private func watchOpenGrouping() async {
    openGrouping = nil
    guard let selectedListId else { return }
    await followLiveQuery(
      "List grouping", subscribe: { session.lists.groupingPropertyId(listPublicId: selectedListId) }
    ) {
      // Grouping is a view preference, so the list still opens, in manual order.
      openGrouping = OpenGrouping(listId: selectedListId, propertyId: nil)
    } onValue: { openGrouping = OpenGrouping(listId: selectedListId, propertyId: $0) }
  }

  /// Waits for the sheet to go, because navigating while it closes can leave a screen that never updates.
  private func openListCreatedInSheet() {
    createdListId = listCreatedInSheet
    listCreatedInSheet = nil
    openCreatedList()
  }

  /// A new list can reach this device after its mutation returns, so opening waits until it is visible.
  private func openCreatedList() {
    guard let createdList = lists?.first(where: { $0.id == createdListId }) else { return }
    visibility = createdList.visibility
    selectedListId = createdList.id
    compactColumn = .detail
    self.createdListId = nil
  }

  /// A widget's list opens once Lists knows it. One that is gone opens as unavailable, as a
  /// remembered list would.
  private func openRequestedList() {
    guard let lists, let publicId = session.openRequest.publicId else { return }
    if let requested = lists.first(where: { $0.id == publicId }) { visibility = requested.visibility }
    selectedListId = publicId
    compactColumn = .detail
    session.openRequest.publicId = nil
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
    if let restored = visibleLists.first(where: { $0.id == selectedListId }) {
      visibility = restored.visibility
    } else {
      lastOpenedList.forget()
      compactColumn = .sidebar
    }
  }
}

private struct OpenGrouping {
  let listId: DomaListSummary.ID
  let propertyId: String?
}

extension EnvironmentValues {
  /// Whether Lists shows its sidebar beside the open list, as on iPad. Columns and sheets report
  /// their own, narrower size class, so they read this instead.
  @Entry var isSplitLayout = false
}
