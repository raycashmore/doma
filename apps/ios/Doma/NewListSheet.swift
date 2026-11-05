import DomaKit
import SwiftUI

struct NewListSheet: View {
  let lists: DomaListsClient
  let onCreated: (DomaListSummary.ID) -> Void
  @Environment(\.dismiss) private var dismiss
  @State private var name = ""
  @State private var visibility = DomaListSummary.Visibility.personal
  @State private var isSaving = false
  @State private var saveFailed = false
  @FocusState private var isNameFocused: Bool

  private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField(
            "List name",
            text: $name,
            prompt: Text("List name").foregroundStyle(DomaColor.warmTextSecondary)
          )
            .domaFont(.body)
            .focused($isNameFocused)
            .submitLabel(.done)
            .onSubmit { Task { await create() } }
        }
        .listRowBackground(DomaColor.warmBgCard)
        Section {
          Picker("Visibility", selection: $visibility) {
            Text("Personal").tag(DomaListSummary.Visibility.personal)
            Text("Shared").tag(DomaListSummary.Visibility.shared)
          }
          .pickerStyle(.segmented)
        } footer: {
          Text(visibility == .shared ? "Everyone in the household can see and edit this list." : "Only you can see this list.")
            .domaFont(.supporting)
            .foregroundStyle(DomaColor.warmTextSecondary)
        }
        .listRowBackground(DomaColor.warmBgCard)
      }
      .domaScreenBackground()
      .navigationTitle("New List")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Create") { Task { await create() } }
            .disabled(trimmedName.isEmpty || isSaving)
        }
      }
      .domaSaveFailureAlert(isPresented: $saveFailed)
    }
    .presentationDetents([.medium, .large])
    .onAppear { isNameFocused = true }
  }

  private func create() async {
    guard !trimmedName.isEmpty, !isSaving else { return }
    isSaving = true
    defer { isSaving = false }
    do {
      let id = try await lists.createList(name: trimmedName, visibility: visibility)
      dismiss()
      onCreated(id)
    } catch {
      saveFailed = true
    }
  }
}
