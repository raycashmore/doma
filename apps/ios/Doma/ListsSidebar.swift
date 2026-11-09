import DomaKit
import SwiftUI

/// The lists overview on iPhone, and the dark sidebar beside the open list on iPad.
struct ListsSidebar: View {
  let lists: [DomaListSummary]
  @Binding var visibility: DomaListSummary.Visibility
  @Binding var selectedListId: DomaListSummary.ID?
  /// Beside an open list, as on iPad, rather than a screen of its own.
  let isSidebar: Bool
  let onNewList: () -> Void

  private var shownLists: [DomaListSummary] { lists.filter { $0.visibility == visibility } }

  var body: some View {
    List(selection: $selectedListId) {
      Section {
        Picker("Show", selection: $visibility) {
          Text("Personal").tag(DomaListSummary.Visibility.personal)
          Text("Shared").tag(DomaListSummary.Visibility.shared)
        }
        .pickerStyle(.segmented)
        .listRowBackground(Color.clear)
        .listRowInsets(EdgeInsets(top: 4, leading: isSidebar ? 12 : 16, bottom: 4, trailing: isSidebar ? 12 : 16))
      }
      Section {
        if shownLists.isEmpty {
          Text(visibility == .shared ? "No shared lists" : "No personal lists")
            .domaFont(.body)
            .foregroundStyle(DomaColor.warmTextSecondary)
            .listRowBackground(isSidebar ? Color.clear : DomaColor.warmBgCard)
        }
        ForEach(shownLists) {
          ListRow(list: $0, isSelected: $0.id == selectedListId, isSidebar: isSidebar)
        }
      }
    }
    .listStyle(.insetGrouped)
    .listSectionSpacing(12)
    .environment(\.defaultMinListRowHeight, 44)
    .safeAreaBar(edge: .bottom) {
      Button(action: onNewList) {
        HStack(spacing: 10) {
          DomaPlusBadge()
          Text("New list")
            .domaFont(.body)
            .foregroundStyle(DomaColor.warmTextTertiary)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 6)
        .contentShape(.capsule)
      }
      .buttonStyle(.plain)
      .domaBottomCapsule()
    }
  }
}
