import DomaKit
import SwiftUI

struct ListDetailView: View {
  let lists: DomaListsClient
  let list: DomaListSummary
  let items: DomaListItems?
  let isUnavailable: Bool
  let isDefault: Bool
  let onDelete: () async -> Void

  var body: some View {
    Group {
      if let items {
        ListItemsView(lists: lists, items: items)
      } else if isUnavailable {
        DomaStateView(title: "This list is unavailable", systemImage: "lock")
      } else {
        DomaLoadingView()
      }
    }
    .navigationTitle(list.name)
    .navigationSubtitle(list.visibility == .shared ? "Shared" : "Personal")
    .toolbar {
      ListActionsMenu(lists: lists, list: list, isDefault: isDefault, onDelete: onDelete)
    }
  }
}
