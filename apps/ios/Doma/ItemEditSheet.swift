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
  @State private var contentHeight: CGFloat?
  @State private var detent = PresentationDetent.large
  @ScaledMetric(relativeTo: .title3) private var checkSize = 24
  /// A centred form sheet rather than one rising from the bottom edge.
  @Environment(\.isSplitLayout) private var isRegularWidth

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
          HStack(spacing: 12) {
            Button {
              model.draft.isCompleted.toggle()
            } label: {
              DomaCheckbox(isChecked: model.draft.isCompleted, size: checkSize)
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Completed")
            .accessibilityValue(model.draft.isCompleted ? "On" : "Off")
            TextField(
              "Title",
              text: $model.draft.title,
              prompt: Text("Title").foregroundStyle(DomaColor.warmTextTertiary),
              axis: .vertical
            )
            .domaFont(.sheetTitle)
            .foregroundStyle(DomaColor.warmTextPrimary)
          }
          .listRowInsets(.leading, 6)
          TextField(
            "Notes",
            text: $model.draft.notes,
            prompt: Text("Notes").foregroundStyle(DomaColor.warmTextTertiary),
            axis: .vertical
          )
          .lineLimit(1...)
          .domaFont(.supporting)
          .foregroundStyle(DomaColor.warmTextSecondary)
          .listRowInsets(.leading, 62)
        }
        .listRowBackground(DomaColor.warmBgCard)
        .listRowSeparatorTint(DomaColor.warmBorder)
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
            Text("Properties")
              .domaFont(.detail)
              .foregroundStyle(DomaColor.warmTextTertiary)
          }
          .listRowBackground(DomaColor.warmBgCard)
          .listRowSeparatorTint(DomaColor.warmBorder)
        }
        Section {
          Button {
            Task { await complete() }
          } label: {
            Label(saved.isCompleted ? "Mark Not Completed" : "Complete", systemImage: saved.isCompleted ? "arrow.uturn.backward" : "checkmark")
              .frame(maxWidth: .infinity)
          }
          .domaPrimaryButton()
          .disabled(!canComplete)
          Button(role: .destructive) {
            isConfirmingDelete = true
          } label: {
            Label("Delete Item", systemImage: "trash")
              .domaFont(.body)
              .foregroundStyle(DomaColor.destructive)
              .frame(maxWidth: .infinity, minHeight: 44)
          }
          .buttonStyle(.plain)
          .confirmationDialog("Delete this item?", isPresented: $isConfirmingDelete, titleVisibility: .visible) {
            Button("Delete Item", role: .destructive) {
              Task { await delete() }
            }
          } message: {
            Text(model.draft.title)
          }
        }
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
        .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
      }
      .listSectionSpacing(16)
      .contentMargins(.top, 0, for: .scrollContent)
      .scrollContentBackground(.hidden)
      .disabled(isBusy)
      .scrollDismissesKeyboard(.interactively)
      .onScrollGeometryChange(for: CGFloat.self) { geometry in
        geometry.contentSize.height + geometry.contentInsets.top + geometry.contentInsets.bottom
      } action: { _, height in
        contentHeight = height
      }
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Close", systemImage: "xmark", role: .close, action: requestDismiss)
            .disabled(isBusy)
        }
        if hasChanges {
          ToolbarItem(placement: .confirmationAction) {
            Button("Save", systemImage: "checkmark", role: .confirm) { Task { await save() } }
              .tint(DomaColor.warmTextPrimary)
              .disabled(isDeleting || !model.canSave(properties: properties))
          }
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
    // As tall as its content until that outgrows the screen, as when the notes run long. On iPad a
    // height detent would pin the sheet to the bottom edge, so it stays a centred form sheet; a fitted
    // form sheet sizes itself before the content is measured and stays collapsed.
    .presentationDetents(isRegularWidth ? [.large] : contentHeight.map { [.height($0), .large] } ?? [.large], selection: $detent)
    .presentationDragIndicator(isRegularWidth ? .hidden : .visible)
    .presentationBackground(DomaColor.sheetBackground)
    .presentationSizing(.form)
    // SwiftUI reports no swipe attempt, so a swipe only resists here; Close offers the discard choice.
    .interactiveDismissDisabled(hasChanges || isBusy)
    .onChange(of: contentHeight) { _, height in
      // Follows the content until someone drags the sheet to full height.
      if let height, !isRegularWidth, detent != .large { detent = .height(height) }
    }
  }

  private var saved: ItemEditFields { model.saved }

  private var canComplete: Bool {
    !isBusy && !model.draft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      && !properties.contains(where: model.isInvalid)
  }

  /// Saves every pending edit along with the new completion, then closes.
  private func complete() async {
    let draftCompletion = model.draft.isCompleted
    model.draft.isCompleted = !saved.isCompleted
    await save()
    if model.draft.isCompleted != saved.isCompleted { model.draft.isCompleted = draftCompletion }
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
