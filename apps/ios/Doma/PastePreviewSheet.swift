import SwiftUI

/// Shows a pasted list before it is added, so a stray line can be removed first.
/// Headings stay visible for context but are not added, as on the web.
struct PastePreviewSheet: View {
  let onAdd: ([String]) async throws -> Void
  @State private var rows: [Row]
  @State private var isSaving = false
  @State private var saveFailed = false
  @Environment(\.dismiss) private var dismiss

  init(pasted: PastedItems, onAdd: @escaping ([String]) async throws -> Void) {
    self.onAdd = onAdd
    _rows = State(initialValue: pasted.entries.enumerated().map { Row(id: $0.offset, entry: $0.element) })
  }

  private var titles: [String] { rows.filter { $0.entry.kind == .item }.map(\.entry.text) }

  var body: some View {
    NavigationStack {
      List {
        Section {
          ForEach(rows) { row in
            switch row.entry.kind {
            case .heading:
              Text(row.entry.text)
                .domaFont(.sectionHeader)
                .foregroundStyle(DomaColor.warmTextSecondary)
                .listRowBackground(Color.clear)
                .deleteDisabled(true)
            case .item:
              Text(row.entry.text)
                .domaFont(.body)
                .foregroundStyle(DomaColor.warmTextPrimary)
                .listRowBackground(DomaColor.warmBgCard)
                .listRowSeparatorTint(DomaColor.warmBorder)
            }
          }
          .onDelete { rows.remove(atOffsets: $0) }
        } footer: {
          Text(rows.contains { $0.entry.kind == .heading } ? "Swipe to remove an item. Headings are not added." : "Swipe to remove an item.")
            .domaFont(.supporting)
            .foregroundStyle(DomaColor.warmTextSecondary)
        }
      }
      .domaScreenBackground()
      .navigationTitle(titles.count == 1 ? "Add 1 Item" : "Add \(titles.count) Items")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel", role: .cancel) { dismiss() }
            .disabled(isSaving)
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Add", action: add)
            .disabled(titles.isEmpty || isSaving)
        }
      }
      .domaSaveFailureAlert(isPresented: $saveFailed)
    }
    .interactiveDismissDisabled(isSaving)
  }

  /// Stays open after a failure so the same items can be retried.
  private func add() {
    isSaving = true
    Task {
      do {
        try await onAdd(titles)
        dismiss()
      } catch {
        saveFailed = true
      }
      isSaving = false
    }
  }

  private struct Row: Identifiable {
    let id: Int
    let entry: PastedItems.Entry
  }
}
