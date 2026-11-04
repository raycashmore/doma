import DomaKit
import SwiftUI

struct ListDetailView: View {
  let lists: DomaListsClient
  let list: DomaListSummary
  @State private var items: DomaListItems?
  @State private var isUnavailable = false
  @State private var actionFailed = false

  var body: some View {
    Group {
      if let items {
        if items.activeItems.isEmpty && items.completedItems.isEmpty {
          DomaStateView(title: "No items yet", systemImage: "checklist")
        } else {
          itemList(items)
        }
      } else if isUnavailable {
        DomaStateView(title: "This list is unavailable", systemImage: "lock")
      } else {
        DomaLoadingView()
      }
    }
    .navigationTitle(list.name)
    .navigationSubtitle(list.visibility == .shared ? "Shared" : "Personal")
    .alert("The change was not saved", isPresented: $actionFailed) {
      Button("OK", role: .cancel) {}
    }
    .task {
      do {
        for try await value in lists.items(listPublicId: list.publicId).values {
          items = value
          isUnavailable = value == nil
        }
      } catch {
        isUnavailable = true
      }
    }
  }

  private func itemList(_ items: DomaListItems) -> some View {
    List {
      if !items.activeItems.isEmpty {
        Section {
          ForEach(items.activeItems) { item in
            ListItemRow(title: item.title, isCompleted: false) {
              await toggle { try await lists.complete(itemId: item.id) }
            }
          }
        } header: {
          DomaSectionHeader(title: "Items", count: items.activeItems.count)
        }
      }
      if !items.completedItems.isEmpty {
        Section {
          ForEach(items.completedItems) { item in
            ListItemRow(title: item.title, isCompleted: true) {
              await toggle { try await lists.uncomplete(itemId: item.id) }
            }
          }
        } header: {
          DomaSectionHeader(title: "Completed")
        }
      }
    }
    .domaScreenBackground()
  }

  private func toggle(_ change: () async throws -> Void) async {
    do {
      try await change()
    } catch {
      actionFailed = true
    }
  }
}
