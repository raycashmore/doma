import DomaKit
import SwiftUI

struct ItemEditSheet: View {
  let lists: DomaListsClient
  let item: DomaListItem
  /// The live list, which can change while the sheet is open.
  let properties: [DomaListProperty]
  @Environment(\.dismiss) private var dismiss
  @State private var model: ItemEditModel
  @State private var isConfirmingDiscard = false
  @State private var isConfirmingDelete = false
  @State private var isDeleting = false
  @State private var saveFailed = false
  @State private var deleteFailed = false

  init(lists: DomaListsClient, item: DomaListItem, properties: [DomaListProperty], isCompleted: Bool) {
    self.lists = lists
    self.item = item
    self.properties = properties
    _model = State(initialValue: ItemEditModel(item: item, properties: properties, isCompleted: isCompleted))
  }

  private var hasChanges: Bool { !model.changes(properties: properties).isEmpty }
  private var isBusy: Bool { model.isSaving || isDeleting }

  var body: some View {
    @Bindable var model = model
    NavigationStack {
      Form {
        Section {
          TextField(
            "Title",
            text: $model.draft.title,
            prompt: Text("Title").foregroundStyle(DomaColor.warmTextSecondary)
          )
          .domaFont(.rowTitle)
          .foregroundStyle(DomaColor.warmTextPrimary)
          TextField(
            "Notes",
            text: $model.draft.notes,
            prompt: Text("Notes").foregroundStyle(DomaColor.warmTextSecondary),
            axis: .vertical
          )
          .lineLimit(3...)
          .domaFont(.body)
          .foregroundStyle(DomaColor.warmTextPrimary)
        }
        .listRowBackground(DomaColor.warmBgCard)
        if !properties.isEmpty {
          Section {
            ForEach(properties) { property in
              PropertyValueField(
                property: property,
                isInvalid: model.isInvalid(property),
                value: Binding(
                  get: { model.draft.values[property.id] ?? PropertyDraft() },
                  set: { model.draft.values[property.id] = $0 }
                )
              )
            }
          } header: {
            DomaSectionHeader(title: "Properties")
          }
          .listRowBackground(DomaColor.warmBgCard)
        }
        Section {
          Toggle(isOn: $model.draft.isCompleted) {
            Text("Completed")
              .domaFont(.body)
              .foregroundStyle(DomaColor.warmTextPrimary)
          }
          .tint(DomaColor.warmAccent)
        }
        .listRowBackground(DomaColor.warmBgCard)
        Section {
          Button(role: .destructive) {
            isConfirmingDelete = true
          } label: {
            Text("Delete Item")
              .domaFont(.body)
              .foregroundStyle(DomaColor.destructive)
              .frame(maxWidth: .infinity)
          }
          .confirmationDialog("Delete this item?", isPresented: $isConfirmingDelete, titleVisibility: .visible) {
            Button("Delete Item", role: .destructive) {
              Task { await delete() }
            }
          } message: {
            Text(model.draft.title)
          }
        }
        .listRowBackground(DomaColor.warmBgCard)
      }
      .domaScreenBackground()
      .disabled(isBusy)
      .scrollDismissesKeyboard(.interactively)
      .navigationTitle("Edit Item")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel", action: requestDismiss)
            .disabled(isBusy)
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") { Task { await save() } }
            .buttonStyle(.borderedProminent)
            .tint(DomaColor.warmTextPrimary)
            .disabled(isDeleting || !model.canSave(properties: properties))
        }
      }
      .confirmationDialog("Discard your changes?", isPresented: $isConfirmingDiscard) {
        Button("Discard Changes", role: .destructive) { dismiss() }
        Button("Keep Editing", role: .cancel) {}
      }
      .domaSaveFailureAlert(isPresented: $deleteFailed)
      .alert("Some changes were not saved", isPresented: $saveFailed) {
        Button("OK", role: .cancel) {}
      } message: {
        Text("Tap Save to try again.")
      }
    }
    .presentationDetents([.large])
    .presentationSizing(.form)
    // SwiftUI reports no swipe attempt, so a swipe only resists here; Cancel offers the discard choice.
    .interactiveDismissDisabled(hasChanges || isBusy)
  }

  private func requestDismiss() {
    if hasChanges {
      isConfirmingDiscard = true
    } else {
      dismiss()
    }
  }

  private func save() async {
    do {
      let didSave = try await model.save(properties: properties) { change in
        try await lists.apply(change, toItem: item.id)
      }
      if didSave { dismiss() }
    } catch {
      saveFailed = true
    }
  }

  private func delete() async {
    isDeleting = true
    defer { isDeleting = false }
    do {
      try await lists.deleteItem(itemId: item.id)
      dismiss()
    } catch {
      deleteFailed = true
    }
  }
}
