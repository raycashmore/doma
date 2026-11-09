import SwiftUI

struct DomaSectionHeader: View {
  /// A section header in a flat list, lined up with the item text's margin.
  static let insets = EdgeInsets(top: 14, leading: 20, bottom: 0, trailing: 20)

  let title: String
  var count: Int?

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 6) {
      Text(title)
        .domaFont(.sectionHeader)
        .foregroundStyle(DomaColor.warmTextPrimary)
      if let count {
        Text(count, format: .number)
          .domaFont(.count)
          .foregroundStyle(DomaColor.warmTextTertiary)
          .accessibilityLabel(count == 1 ? "1 item" : "\(count) items")
      }
    }
    .textCase(nil)
  }
}
