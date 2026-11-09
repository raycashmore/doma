import DomaKit
import SwiftUI

struct GroupByMenu: View {
  let properties: [DomaListProperty]
  @Binding var groupingPropertyId: String?
  /// Unassigned items the server could categorise, or `nil` when no property is set up for it.
  let unassignedCount: Int?
  let isCategorising: Bool
  let onCategorise: () -> Void

  var body: some View {
    Menu("Group By", systemImage: "rectangle.3.group") {
      Picker("Group By", selection: $groupingPropertyId) {
        Text("Manual Order").tag(String?.none)
        ForEach(properties) { property in
          Text(property.name).tag(Optional(property.id))
        }
      }
      if let unassignedCount {
        Section {
          // A menu reads the first text as the title, the second as its subtitle, and the image as the icon.
          Button(action: onCategorise) {
            Text("Auto Categorise")
            Text(unassignedCount == 1 ? "1 Unassigned item" : "\(unassignedCount) Unassigned items")
            Image(systemName: "sparkles")
          }
          .disabled(unassignedCount == 0 || isCategorising)
        }
      }
    }
  }
}
