import DomaKit
import SwiftUI

struct ListItemsView: View {
  let lists: DomaListsClient
  let items: DomaListItems
  /// Holds a dragged order until the server confirms it, so the row does not snap back.
  @State private var reorderedItems: [DomaListItem]?
  @State private var movesInFlight = 0
  @State private var itemToDelete: DomaListItem?
  @State private var isConfirmingClear = false
  @State private var saveFailed = false

  private var activeItems: [DomaListItem] { reorderedItems ?? items.activeItems }

  var body: some View {
    List {
      Section {
        AddItemField { title in
          await save { try await lists.createItem(listPublicId: items.list.publicId, title: title) }
        }
      }
      if activeItems.isEmpty && items.completedItems.isEmpty {
        DomaStateView(title: "No items yet", systemImage: "checklist")
          .listRowBackground(Color.clear)
          .listRowSeparator(.hidden)
      }
      if !activeItems.isEmpty {
        Section {
          ForEach(activeItems) { item in
            row(item, isCompleted: false)
              .accessibilityAction(named: "Move Up") { move(item, by: -1) }
              .accessibilityAction(named: "Move Down") { move(item, by: 2) }
          }
          .onMove(perform: move)
        } header: {
          DomaSectionHeader(title: "Items", count: activeItems.count)
        }
      }
      if !items.completedItems.isEmpty {
        Section {
          ForEach(items.completedItems) { row($0, isCompleted: true) }
        } header: {
          HStack {
            DomaSectionHeader(title: "Completed")
            Spacer()
            Button {
              isConfirmingClear = true
            } label: {
              Text("Clear")
                .domaFont(.sectionHeader)
                .foregroundStyle(DomaColor.warmTextPrimary)
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(.rect)
            }
            .accessibilityLabel("Clear completed items")
            .confirmationDialog("Clear completed items?", isPresented: $isConfirmingClear, titleVisibility: .visible) {
              Button("Clear Completed", role: .destructive) {
                Task { await save { try await lists.clearCompletedItems(listPublicId: items.list.publicId) } }
              }
            } message: {
              Text("This deletes every completed item in this list.")
            }
          }
        }
      }
    }
    .domaScreenBackground()
    .scrollDismissesKeyboard(.interactively)
    .domaSaveFailureAlert(isPresented: $saveFailed)
  }

  private func row(_ item: DomaListItem, isCompleted: Bool) -> some View {
    ListItemRow(title: item.title, isCompleted: isCompleted) {
      await save {
        if isCompleted {
          try await lists.uncomplete(itemId: item.id)
        } else {
          try await lists.complete(itemId: item.id)
        }
      }
    }
    .swipeActions {
      // Not a destructive role: that removes the row before the confirmation is answered.
      Button("Delete", systemImage: "trash") { itemToDelete = item }
        .tint(.red)
    }
    .confirmationDialog("Delete this item?", isPresented: isConfirmingDelete(item), titleVisibility: .visible) {
      Button("Delete Item", role: .destructive) {
        Task { await save { try await lists.deleteItem(itemId: item.id) } }
      }
    } message: {
      Text(item.title)
    }
  }

  private func isConfirmingDelete(_ item: DomaListItem) -> Binding<Bool> {
    Binding(get: { itemToDelete == item }, set: { if !$0 { itemToDelete = nil } })
  }

  private func move(_ item: DomaListItem, by offset: Int) {
    guard let index = activeItems.firstIndex(of: item) else { return }
    move(from: IndexSet(integer: index), to: index + offset)
  }

  private func move(from source: IndexSet, to destination: Int) {
    guard let move = ListItemMove(items: activeItems, from: source, to: destination) else { return }
    reorderedItems = move.reorderedItems
    movesInFlight += 1
    Task {
      await save { try await lists.reorderItem(itemId: move.itemId, targetIndex: move.targetIndex) }
      movesInFlight -= 1
      if movesInFlight == 0 { reorderedItems = nil }
    }
  }

  @discardableResult
  private func save(_ change: () async throws -> Void) async -> Bool {
    do {
      try await change()
      return true
    } catch {
      saveFailed = true
      return false
    }
  }
}
