import DomaKit
import SwiftUI

/// Writes or edits a shared note. Nothing is sent until Save.
struct NoteEditorSheet: View {
  let home: DomaHomeClient
  private let original: ManualNoteDraft
  @State private var draft: ManualNoteDraft
  @State private var isSaving = false
  @State private var saveFailed = false
  @Environment(\.dismiss) private var dismiss

  init(draft: ManualNoteDraft, home: DomaHomeClient) {
    self.home = home
    original = draft
    _draft = State(initialValue: draft)
  }

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("Title", text: $draft.title, axis: .vertical)
            .domaFont(.body)
          TextField("Detail", text: $draft.detail, axis: .vertical)
            .domaFont(.body)
            .lineLimit(3...)
        } footer: {
          if let problem = draft.problem, draft != original {
            Text(problem)
              .domaFont(.detail)
              .foregroundStyle(DomaColor.warmTextSecondary)
          }
        }
        Section {
          Toggle(isOn: $draft.hasDueDate) {
            Text("Due date").domaFont(.body)
          }
          if draft.hasDueDate {
            DatePicker(selection: $draft.dueDate, displayedComponents: .date) {
              Text("Date").domaFont(.body)
            }
            .environment(\.timeZone, draft.timeZone)
          }
        }
      }
      .domaScreenBackground()
      .foregroundStyle(DomaColor.warmTextPrimary)
      .navigationTitle(draft.noteId == nil ? "New note" : "Edit note")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") { save() }
            .disabled(draft.problem != nil || isSaving)
        }
      }
    }
    .tint(DomaColor.warmTextPrimary)
    .interactiveDismissDisabled(draft != original || isSaving)
    .domaSaveFailureAlert(isPresented: $saveFailed)
  }

  private func save() {
    isSaving = true
    let draft = draft
    Task {
      do {
        if let noteId = draft.noteId {
          try await home.updateNote(
            noteId: noteId, title: draft.trimmedTitle, detail: draft.trimmedDetail, dueDate: draft.dueDateValue)
        } else {
          try await home.createNote(title: draft.trimmedTitle, detail: draft.trimmedDetail, dueDate: draft.dueDateValue)
        }
        dismiss()
      } catch {
        isSaving = false
        saveFailed = true
      }
    }
  }
}
