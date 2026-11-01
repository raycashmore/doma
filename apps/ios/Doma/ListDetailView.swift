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
        List {
          Section {
            ForEach(items.activeItems) { item in
              ListItemRow(title: item.title, isCompleted: false) {
                await toggle { try await lists.complete(itemId: item.id) }
              }
            }
          }
          if !items.completedItems.isEmpty {
            Section("Completed") {
              ForEach(items.completedItems) { item in
                ListItemRow(title: item.title, isCompleted: true) {
                  await toggle { try await lists.uncomplete(itemId: item.id) }
                }
              }
            }
          }
        }
        .overlay {
          if items.activeItems.isEmpty && items.completedItems.isEmpty {
            ContentUnavailableView("No items", systemImage: "checklist")
          }
        }
      } else if isUnavailable {
        ContentUnavailableView("This list is unavailable", systemImage: "lock")
      } else {
        ProgressView()
      }
    }
    .navigationTitle(list.name)
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

  private func toggle(_ change: () async throws -> Void) async {
    do {
      try await change()
    } catch {
      actionFailed = true
    }
  }
}
