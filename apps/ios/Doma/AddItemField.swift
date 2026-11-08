import SwiftUI

struct AddItemField: View {
  /// Returns whether the item was saved.
  let onAdd: (String) async -> Bool
  /// A paste that holds several items, which the field leaves for a preview.
  let onPaste: (PastedItems) -> Void
  @State private var title = ""
  @FocusState private var isFocused: Bool

  private var trimmedTitle: String { title.trimmingCharacters(in: .whitespacesAndNewlines) }

  var body: some View {
    HStack(spacing: 12) {
      Image(systemName: "plus")
        .foregroundStyle(DomaColor.warmAccent)
        .accessibilityHidden(true)
      // Vertical, so a pasted list arrives with its line breaks; Return still adds the item.
      TextField(
        "Add an item",
        text: $title,
        prompt: Text("Add an item").foregroundStyle(DomaColor.warmTextSecondary),
        axis: .vertical
      )
      .lineLimit(1...4)
      .domaFont(.body)
      .foregroundStyle(DomaColor.warmTextPrimary)
      .focused($isFocused)
      .submitLabel(.done)
      .onSubmit(add)
      .onChange(of: title) { old, new in read(AddItemInput(from: old, to: new)) }
      if !trimmedTitle.isEmpty {
        Button("Add", action: add)
          .domaPrimaryButton()
      }
    }
    // Matches the Add button, so the list does not shift when it appears.
    .frame(minHeight: 52)
    .padding(.horizontal, 20)
    .padding(.vertical, 8)
    .background(DomaColor.warmBgCard, in: .rect(cornerRadius: 26))
    .overlay {
      if isFocused {
        RoundedRectangle(cornerRadius: 26).strokeBorder(DomaColor.warmAccent, lineWidth: 2)
      }
    }
    .listRowInsets(EdgeInsets())
    .listRowBackground(Color.clear)
  }

  private func read(_ input: AddItemInput) {
    switch input {
    case .typed: break
    case .replace(let text): title = text
    case .submit(let text):
      title = text
      add()
    case .paste(let pasted, let restoring):
      title = restoring
      onPaste(pasted)
    }
  }

  /// Clears straight away so items can be typed in a row; a failed title comes back to retry.
  private func add() {
    isFocused = true
    let submitted = trimmedTitle
    guard !submitted.isEmpty else { return }
    title = ""
    Task {
      let saved = await onAdd(submitted)
      if !saved && title.isEmpty { title = submitted }
    }
  }
}
