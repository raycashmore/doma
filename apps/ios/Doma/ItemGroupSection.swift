import DomaKit
import SwiftUI

/// One group of active items, collapsed by tapping its header.
struct ItemGroupSection<Row: View>: View {
  let group: ListItemGroup
  @Binding var isCollapsed: Bool
  @ViewBuilder let row: (DomaListItem) -> Row

  var body: some View {
    Section {
      if !isCollapsed {
        ForEach(group.items) { row($0) }
      }
    } header: {
      Button {
        withAnimation { isCollapsed.toggle() }
      } label: {
        HStack {
          DomaSectionHeader(title: group.label, count: group.items.count)
          Spacer()
          Image(systemName: "chevron.down")
            .imageScale(.small)
            .foregroundStyle(DomaColor.warmTextSecondary)
            .rotationEffect(.degrees(isCollapsed ? -90 : 0))
        }
        .frame(minHeight: 44)
        .contentShape(.rect)
      }
      .buttonStyle(.plain)
      .accessibilityElement(children: .combine)
      .accessibilityValue(isCollapsed ? "Collapsed" : "Expanded")
      .accessibilityHint(isCollapsed ? "Shows the group's items" : "Hides the group's items")
    }
  }
}
