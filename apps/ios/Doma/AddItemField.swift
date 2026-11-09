import SwiftUI

struct AddItemField: View {
  /// Returns whether the items were saved.
  let onAdd: ([String]) async -> Bool
  /// A paste that holds several items, which the field leaves for a preview.
  let onPaste: (PastedItems) -> Void
  @State private var title = ""
  @FocusState private var isFocused: Bool

  private var trimmedTitle: String { title.trimmingCharacters(in: .whitespacesAndNewlines) }

  var body: some View {
    HStack(spacing: 10) {
      DomaPlusBadge()
      // Vertical, so a pasted list arrives with its line breaks; Return still adds the item.
      TextField(
        "Add an item",
        text: $title,
        prompt: Text("Add an item or paste a list").foregroundStyle(DomaColor.warmTextTertiary),
        axis: .vertical
      )
      .lineLimit(1...4)
      .frame(maxWidth: .infinity, alignment: .leading)
      .domaFont(.body)
      .foregroundStyle(DomaColor.warmTextPrimary)
      .focused($isFocused)
      .submitLabel(.done)
      .onSubmit(add)
      .onChange(of: title) { old, new in read(AddItemInput(from: old, to: new)) }
      if !trimmedTitle.isEmpty {
        Button("Add", action: add)
          .domaFont(.button)
          .buttonStyle(.borderedProminent)
          .buttonBorderShape(.capsule)
          // Regular, so the button fits inside the empty capsule and the field keeps its height.
          .controlSize(.regular)
          .tint(DomaColor.warmTextPrimary)
          .foregroundStyle(DomaColor.warmBgCardSoft)
      }
    }
    .padding(.vertical, 6)
    // The whole capsule takes focus, not only the text's own width.
    .contentShape(.capsule)
    .onTapGesture { isFocused = true }
    .domaBottomCapsule()
  }

  private func read(_ input: AddItemInput) {
    switch input {
    case .typed: break
    case .submit(let text):
      title = text
      add()
    case .paste(let pasted, let restoring):
      title = restoring
      onPaste(pasted)
    }
  }

  /// Clears straight away so items can be typed in a row; failed text comes back to retry.
  private func add() {
    isFocused = true
    let submitted = trimmedTitle
    let titles = SubmittedItems.titles(in: submitted)
    guard !titles.isEmpty else { return }
    title = ""
    Task {
      let saved = await onAdd(titles)
      if !saved && title.isEmpty { title = submitted }
    }
  }
}

/// The accent plus at the start of a bottom capsule.
struct DomaPlusBadge: View {
  @ScaledMetric(relativeTo: .body) private var size = 32

  var body: some View {
    Image(systemName: "plus")
      .font(.body.weight(.semibold))
      .foregroundStyle(DomaColor.warmTextOnDark)
      .frame(width: size, height: size)
      .background(DomaColor.warmAccent, in: .circle)
      .accessibilityHidden(true)
  }
}
