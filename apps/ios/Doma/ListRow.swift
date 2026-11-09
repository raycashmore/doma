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
          .domaFont(.body)
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
    // The sidebar leaves selection to the system, which merges it with the keyboard focus.
    .listRowBackground(isSidebar ? nil : background)
    .listRowSeparator(isSidebar ? .hidden : .automatic)
    .listRowSeparatorTint(DomaColor.warmBorder)
  }

  private var background: Color {
    isSelected ? DomaColor.warmBorder : DomaColor.warmBgCard
  }
}
