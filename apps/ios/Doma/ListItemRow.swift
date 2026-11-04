import SwiftUI

struct ListItemRow: View {
  let title: String
  let isCompleted: Bool
  let onToggle: () async -> Void

  var body: some View {
    Button {
      Task { await onToggle() }
    } label: {
      HStack(spacing: 12) {
        Image(systemName: isCompleted ? "checkmark.circle.fill" : "circle")
          .font(.title2)
          .symbolRenderingMode(.palette)
          .foregroundStyle(
            isCompleted ? DomaColor.warmBgCard : DomaColor.warmTextSecondary,
            DomaColor.warmAccent
          )
          .contentTransition(.symbolEffect(.replace))
          .accessibilityHidden(true)
        Text(title)
          .domaFont(isCompleted ? .body : .rowTitle)
          .strikethrough(isCompleted)
          .foregroundStyle(isCompleted ? DomaColor.warmTextSecondary : DomaColor.warmTextPrimary)
        Spacer(minLength: 0)
      }
      .frame(minHeight: 44)
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .listRowBackground(DomaColor.warmBgCard)
    .listRowSeparatorTint(DomaColor.warmBorder)
    .accessibilityValue(isCompleted ? "Completed" : "Not completed")
    .accessibilityHint(isCompleted ? "Marks the item as not completed" : "Marks the item as completed")
  }
}
