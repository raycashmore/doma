import DomaKit
import SwiftUI

/// The list's settings: how it groups, then the list itself.
struct ListActionsMenu<Grouping: View>: View {
  let lists: DomaListsClient
  let list: DomaListSummary
  let isDefault: Bool
  let onDelete: () async -> Void
  @ViewBuilder let grouping: () -> Grouping
  @State private var isRenaming = false
  @State private var draftName = ""
  @State private var isConfirmingDelete = false
  @State private var saveFailed = false

  private var trimmedName: String { draftName.trimmingCharacters(in: .whitespacesAndNewlines) }

  var body: some View {
    Menu("List Settings", systemImage: "gearshape") {
      Section { grouping() }
      Button("Rename", systemImage: "pencil") {
        draftName = list.name
        isRenaming = true
      }
      Button(isDefault ? "Default List" : "Set as Default", systemImage: isDefault ? "checkmark" : "star") {
        Task { await save { try await lists.setDefaultList(publicId: list.publicId) } }
      }
      .disabled(isDefault)
      Button("Delete List", systemImage: "trash", role: .destructive) { isConfirmingDelete = true }
    }
    .alert("Rename List", isPresented: $isRenaming) {
      TextField("List name", text: $draftName)
      Button("Cancel", role: .cancel) {}
      Button("Save") {
        let name = trimmedName
        Task { await save { try await lists.renameList(publicId: list.publicId, name: name) } }
      }
      .disabled(trimmedName.isEmpty)
    }
    .confirmationDialog("Delete \(list.name)?", isPresented: $isConfirmingDelete, titleVisibility: .visible) {
      Button("Delete List", role: .destructive) {
        Task { await onDelete() }
      }
    } message: {
      Text("This permanently deletes the list and its items.")
    }
    .domaSaveFailureAlert(isPresented: $saveFailed)
  }

  private func save(_ change: () async throws -> Void) async {
    do {
      try await change()
    } catch {
      saveFailed = true
    }
  }
}
