import SwiftUI

struct ListItemRow: View {
  let title: String
  let isCompleted: Bool
  let onToggle: () async -> Void

  var body: some View {
    Button {
      Task { await onToggle() }
    } label: {
      Label {
        Text(title)
          .strikethrough(isCompleted)
          .foregroundStyle(isCompleted ? .secondary : .primary)
      } icon: {
        Image(systemName: isCompleted ? "checkmark.circle.fill" : "circle")
      }
    }
    .buttonStyle(.plain)
    .accessibilityValue(isCompleted ? "Completed" : "Not completed")
    .accessibilityHint(isCompleted ? "Marks the item as not completed" : "Marks the item as completed")
  }
}
