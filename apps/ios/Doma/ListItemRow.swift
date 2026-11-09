import SwiftUI

struct ListItemRow: View {
  let title: String
  let details: [RowDetail]
  let isCompleted: Bool
  let onToggle: () async -> Void
  let onOpen: () -> Void
  @ScaledMetric(relativeTo: .body) private var checkTapSize = 44
  @ScaledMetric(relativeTo: .body) private var checkSize = 22

  private var completionAction: String { isCompleted ? "Mark Not Completed" : "Mark Completed" }
  private var spokenDetails: String { details.map(\.text).joined(separator: ", ") }

  var body: some View {
    HStack(spacing: 3) {
      Button {
        Task { await onToggle() }
      } label: {
        DomaCheckbox(isChecked: isCompleted, size: checkSize)
          .frame(width: checkTapSize, height: checkTapSize)
          .contentShape(.rect)
      }
      .buttonStyle(.plain)
      .accessibilityLabel(completionAction)
      Button(action: onOpen) {
        VStack(alignment: .leading, spacing: 2) {
          Text(title)
            .domaFont(.body)
            .strikethrough(isCompleted)
            .foregroundStyle(isCompleted ? DomaColor.warmTextTertiary : DomaColor.warmTextPrimary)
          if !details.isEmpty && !isCompleted {
            detailLine
              .domaFont(.detail)
              .lineLimit(1)
          }
        }
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, minHeight: checkTapSize, alignment: .leading)
        .contentShape(.rect)
      }
      .buttonStyle(.plain)
      .alignmentGuide(.listRowSeparatorLeading) { $0[.leading] }
    }
    .listRowInsets(EdgeInsets(top: 2, leading: 9, bottom: 2, trailing: 20))
    .listRowBackground(Color.clear)
    .listRowSeparatorTint(DomaColor.warmBorder)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(details.isEmpty ? title : "\(title), \(spokenDetails)")
    .accessibilityValue(isCompleted ? "Completed" : "Not completed")
    .accessibilityHint("Opens the item")
    .accessibilityAddTraits(.isButton)
    .accessibilityAction(.default, onOpen)
    .accessibilityAction(named: completionAction) {
      Task { await onToggle() }
    }
  }

  private var detailLine: Text {
    details.enumerated().reduce(Text("")) { line, entry in
      let (index, detail) = entry
      let separator = index == 0 ? Text("") : Text(" · ").foregroundStyle(DomaColor.warmTextSecondary)
      let part =
        detail.isDate
        ? Text("\(Image(systemName: "calendar")) \(detail.text)").foregroundStyle(DomaColor.warmAccent)
        : Text(detail.text).foregroundStyle(DomaColor.warmTextSecondary)
      return Text("\(line)\(separator)\(part)")
    }
  }
}

/// The ring an item is ticked off in. Ticked, it fills with the accent.
struct DomaCheckbox: View {
  let isChecked: Bool
  let size: CGFloat

  var body: some View {
    Image(systemName: isChecked ? "checkmark.circle.fill" : "circle")
      .resizable()
      .fontWeight(.light)
      .symbolRenderingMode(.palette)
      .foregroundStyle(isChecked ? DomaColor.warmBgCard : DomaColor.checkRing, DomaColor.warmAccent)
      .contentTransition(.symbolEffect(.replace))
      .frame(width: size, height: size)
      .accessibilityHidden(true)
  }
}
