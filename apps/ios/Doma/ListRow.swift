import DomaKit
import SwiftUI

struct ListRow: View {
  let list: DomaListSummary
  let isSelected: Bool
  let isSidebar: Bool

  var body: some View {
    NavigationLink(value: list.id) {
      HStack(spacing: 6) {
        Text(list.name)
          .domaFont(isSelected && isSidebar ? .sectionHeader : .body)
          .foregroundStyle(DomaColor.warmTextPrimary)
        if list.visibility == .shared {
          Image(systemName: "person.2")
            .imageScale(.small)
            .foregroundStyle(DomaColor.warmTextSecondary)
            .accessibilityLabel("Shared")
        }
      }
      .frame(minHeight: 28)
    }
    .listRowInsets(.vertical, isSidebar ? 4 : 6)
    .listRowBackground(background)
    .listRowSeparator(isSidebar ? .hidden : .automatic)
    .listRowSeparatorTint(DomaColor.warmBorder)
  }

  @ViewBuilder
  private var background: some View {
    if isSidebar {
      if isSelected {
        RoundedRectangle(cornerRadius: 10, style: .continuous)
          .fill(DomaColor.onDarkHighlight)
          .padding(.horizontal, 8)
      } else {
        Color.clear
      }
    } else {
      isSelected ? DomaColor.warmBorder : DomaColor.warmBgCard
    }
  }
}
