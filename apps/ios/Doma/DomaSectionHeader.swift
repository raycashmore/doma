import SwiftUI

struct DomaSectionHeader: View {
  let title: String
  var count: Int?

  var body: some View {
    HStack(spacing: 8) {
      Text(title)
        .domaFont(.sectionHeader)
        .foregroundStyle(DomaColor.warmTextSecondary)
      if let count {
        Text(count, format: .number)
          .domaFont(.count)
          .foregroundStyle(DomaColor.warmTextSecondary)
          .padding(.horizontal, 8)
          .padding(.vertical, 2)
          .background(DomaColor.warmSectionMortgage, in: .capsule)
          .accessibilityLabel(count == 1 ? "1 active item" : "\(count) active items")
      }
    }
    .textCase(nil)
  }
}
