import DomaKit
import SwiftUI

struct ListsSidebar: View {
  let lists: [DomaListSummary]
  let defaultListId: DomaListSummary.ID?
  @Binding var selectedListId: DomaListSummary.ID?

  private var personalLists: [DomaListSummary] { lists.filter { $0.visibility != .shared } }
  private var sharedLists: [DomaListSummary] { lists.filter { $0.visibility == .shared } }

  var body: some View {
    if lists.isEmpty {
      DomaStateView(title: "No lists yet", systemImage: "checklist")
    } else {
      List(selection: $selectedListId) {
        section("Personal", lists: personalLists)
        section("Shared", lists: sharedLists)
      }
      .domaScreenBackground()
    }
  }

  @ViewBuilder
  private func section(_ title: String, lists: [DomaListSummary]) -> some View {
    if !lists.isEmpty {
      Section {
        ForEach(lists) {
          ListRow(list: $0, isSelected: $0.id == selectedListId, isDefault: $0.id == defaultListId)
        }
      } header: {
        DomaSectionHeader(title: title)
      }
    }
  }
}
