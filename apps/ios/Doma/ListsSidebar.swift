import DomaKit
import SwiftUI

/// The lists overview on iPhone, and the dark sidebar beside the open list on iPad.
struct ListsSidebar: View {
  let lists: [DomaListSummary]
  @Binding var visibility: DomaListSummary.Visibility
  @Binding var selectedListId: DomaListSummary.ID?
  /// Beside an open list, as on iPad, rather than a screen of its own.
  let isSidebar: Bool
  /// Saves a list's new position in its tab.
  let onReorder: (_ publicId: String, _ targetIndex: Int) async throws -> Void
  let onNewList: () -> Void
  /// Each tab's dragged order, held until the live list confirms it.
  @State private var sharedOrder = HeldOrder()
  @State private var personalOrder = HeldOrder()
  @State private var saveFailed = false

  private var shownLists: [DomaListSummary] { heldOrder(visibility).ordered(tab(visibility)) }

  var body: some View {
    List(selection: $selectedListId) {
      Section {
        Picker("Show", selection: $visibility) {
          Text("Shared").tag(DomaListSummary.Visibility.shared)
          Text("Personal").tag(DomaListSummary.Visibility.personal)
        }
        .pickerStyle(.segmented)
        .listRowBackground(Color.clear)
        // In the sidebar, the switch spans the same width as the selection and the New list capsule.
        .listRowInsets(EdgeInsets(top: isSidebar ? 16 : 4, leading: isSidebar ? 0 : 16, bottom: 4, trailing: isSidebar ? 0 : 16))
      }
      Section {
        if shownLists.isEmpty {
          Text(visibility == .shared ? "No shared lists" : "No personal lists")
            .domaFont(.body)
            .foregroundStyle(DomaColor.warmTextSecondary)
            .listRowBackground(isSidebar ? nil : DomaColor.warmBgCard)
        }
        ForEach(shownLists) { list in
          ListRow(list: list, isSelected: list.id == selectedListId, isSidebar: isSidebar)
            .accessibilityAction(named: "Move Up") { move(list, by: -1) }
            .accessibilityAction(named: "Move Down") { move(list, by: 2) }
        }
        .onMove(perform: move)
      }
    }
    .listStyle(sidebar: isSidebar)
    .listSectionSpacing(12)
    .environment(\.defaultMinListRowHeight, 44)
    .onChange(of: lists) {
      sharedOrder.serverChanged(to: tab(.shared).map(\.id))
      personalOrder.serverChanged(to: tab(.personal).map(\.id))
    }
    .domaSaveFailureAlert(isPresented: $saveFailed)
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

  private func heldOrder(_ visibility: DomaListSummary.Visibility) -> HeldOrder {
    visibility == .shared ? sharedOrder : personalOrder
  }

  private func tab(_ visibility: DomaListSummary.Visibility) -> [DomaListSummary] {
    lists.filter { $0.visibility == visibility }
  }

  private func move(_ list: DomaListSummary, by offset: Int) {
    guard let index = shownLists.firstIndex(of: list) else { return }
    move(from: IndexSet(integer: index), to: index + offset)
  }

  private func move(from source: IndexSet, to destination: Int) {
    guard let move = OrderMove(shownLists, from: source, to: destination) else { return }
    heldOrder(visibility).hold(move.reordered.map(\.id)) {
      try await onReorder(move.movedId, move.targetIndex)
    } onFailure: {
      saveFailed = true
    }
  }
}

private extension View {
  /// The system sidebar on iPad draws selection and keyboard focus as one highlight, in the accent
  /// when the sidebar has focus.
  @ViewBuilder
  func listStyle(sidebar: Bool) -> some View {
    if sidebar {
      listStyle(.sidebar).tint(DomaColor.warmAccent)
    } else {
      listStyle(.insetGrouped)
    }
  }
}
