import SwiftUI

struct ListItemRow: View {
  let title: String
  let valueSummary: String
  let isCompleted: Bool
  let onToggle: () async -> Void
  let onOpen: () -> Void
  @ScaledMetric(relativeTo: .title2) private var circleTapSize = 44

  private var completionAction: String { isCompleted ? "Mark Not Completed" : "Mark Completed" }

  var body: some View {
    HStack(spacing: 4) {
      Button {
        Task { await onToggle() }
      } label: {
        Image(systemName: isCompleted ? "checkmark.circle.fill" : "circle")
          .font(.title2)
          .symbolRenderingMode(.palette)
          .foregroundStyle(
            isCompleted ? DomaColor.warmBgCard : DomaColor.warmTextSecondary,
            DomaColor.warmAccent
          )
          .contentTransition(.symbolEffect(.replace))
          .frame(width: circleTapSize, height: circleTapSize)
          .contentShape(.rect)
      }
      .buttonStyle(.plain)
      .accessibilityLabel(completionAction)
      Button(action: onOpen) {
        HStack(spacing: 12) {
          Text(title)
            .domaFont(isCompleted ? .body : .rowTitle)
            .strikethrough(isCompleted)
            .foregroundStyle(isCompleted ? DomaColor.warmTextSecondary : DomaColor.warmTextPrimary)
          Spacer(minLength: 0)
          if !valueSummary.isEmpty {
            Text(valueSummary)
              .domaFont(.supporting)
              .foregroundStyle(DomaColor.warmTextSecondary)
              .lineLimit(1)
          }
        }
        .frame(minHeight: 44)
        .contentShape(.rect)
      }
      .buttonStyle(.plain)
    }
    .listRowInsets(.leading, 8)
    .listRowBackground(DomaColor.warmBgCard)
    .listRowSeparatorTint(DomaColor.warmBorder)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(valueSummary.isEmpty ? title : "\(title), \(valueSummary)")
    .accessibilityValue(isCompleted ? "Completed" : "Not completed")
    .accessibilityHint("Opens the item")
    .accessibilityAddTraits(.isButton)
    .accessibilityAction(.default, onOpen)
    .accessibilityAction(named: completionAction) {
      Task { await onToggle() }
    }
  }
}
