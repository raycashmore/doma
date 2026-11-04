import DomaKit
import SwiftUI

struct ListRow: View {
  let list: DomaListSummary
  let isSelected: Bool
  @ScaledMetric(relativeTo: .body) private var tileSize = 36

  var body: some View {
    NavigationLink(value: list.id) {
      HStack(spacing: 12) {
        Image(systemName: "checklist")
          .foregroundStyle(DomaColor.warmAccent)
          .frame(width: tileSize, height: tileSize)
          .background(DomaColor.warmBgCardSoft, in: .rect(cornerRadius: 11))
          .overlay {
            RoundedRectangle(cornerRadius: 11).stroke(DomaColor.warmBorder)
          }
          .accessibilityHidden(true)
        Text(list.name)
          .domaFont(.rowTitle)
          .foregroundStyle(DomaColor.warmTextPrimary)
      }
    }
    .listRowBackground(isSelected ? DomaColor.warmSectionMortgage : DomaColor.warmBgCard)
    .listRowSeparatorTint(DomaColor.warmBorder)
  }
}
