import DomaKit
import SwiftUI

/// Get Paprika Items: shows what's coming from the person's Paprika list, grouped by recipe, and
/// imports the ticked items into their Groceries list. Items brought in before but still in Paprika
/// can be shown and added again. One read of Paprika when it opens.
struct PaprikaImportSheet: View {
  let paprika: DomaPaprikaClient
  @Environment(\.dismiss) private var dismiss
  @State private var preview: DomaPaprikaImportPreview?
  @State private var loadFailed = false
  /// New items start ticked; these are the ones the person unticked.
  @State private var unticked: Set<String> = []
  /// Items brought in before start unticked; these are the ones the person ticked to add again.
  @State private var reticked: Set<String> = []
  @State private var showsAlreadyImported = false
  @State private var removeFromPaprika = true
  @State private var isImporting = false
  @State private var outcome: (title: String, message: String, isProblem: Bool)?

  private var items: [DomaPaprikaImportItem] {
    if case .items(let items, _) = preview { items } else { [] }
  }

  private var alreadyImported: [DomaPaprikaImportItem] {
    if case .items(_, let alreadyImported) = preview { alreadyImported } else { [] }
  }

  private var tickedUids: [String] { items.map(\.uid).filter { !unticked.contains($0) } }
  private var reimportUids: [String] { alreadyImported.map(\.uid).filter { reticked.contains($0) } }

  var body: some View {
    NavigationStack {
      content
        .domaScreenBackground()
        .navigationTitle("Get Paprika Items")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) {
            Button("Cancel") { dismiss() }
          }
          ToolbarItem(placement: .confirmationAction) {
            if isImporting {
              ProgressView()
            } else if !items.isEmpty || !alreadyImported.isEmpty {
              Button("Import") { Task { await importTicked() } }
                .disabled(tickedUids.isEmpty && reimportUids.isEmpty)
            }
          }
        }
    }
    .tint(DomaColor.warmTextPrimary)
    .alert(
      outcome?.title ?? "",
      isPresented: Binding(get: { outcome != nil }, set: { if !$0 { finish() } })
    ) {
      Button("OK", role: .cancel) {}
    } message: {
      Text(outcome?.message ?? "")
    }
    .task { await load() }
  }

  @ViewBuilder
  private var content: some View {
    if let preview {
      if let problem = PaprikaImportCopy.previewProblem(preview) {
        message(problem, systemImage: "exclamationmark.triangle")
      } else if items.isEmpty && alreadyImported.isEmpty {
        message(PaprikaImportCopy.nothingNew, systemImage: "basket")
      } else {
        itemsForm
      }
    } else if loadFailed {
      message("Couldn't reach Doma. Nothing on your list changed.", systemImage: "exclamationmark.triangle")
    } else {
      DomaLoadingView(message: "Reading Paprika...")
    }
  }

  private var itemsForm: some View {
    Form {
      if items.isEmpty {
        Section {
          Text(PaprikaImportCopy.nothingNew).domaFont(.body)
        }
        .listRowBackground(DomaColor.warmBgCard)
      }
      ForEach(PaprikaImportCopy.groups(items)) { group in
        Section {
          ForEach(group.items) { item in
            Toggle(isOn: isTicked(item)) {
              Text(item.title).domaFont(.body)
            }
            .toggleStyle(PaprikaTickStyle())
          }
        } header: {
          Text(group.title).domaFont(.supporting)
        }
        .listRowBackground(DomaColor.warmBgCard)
      }
      alreadyImportedSection
      Section {
        Toggle("Remove from Paprika", isOn: $removeFromPaprika).domaFont(.body)
      } footer: {
        Text(PaprikaImportCopy.removalFootnote)
          .domaFont(.supporting)
          .foregroundStyle(DomaColor.warmTextSecondary)
      }
      .listRowBackground(DomaColor.warmBgCard)
    }
    .disabled(isImporting)
  }

  @ViewBuilder
  private var alreadyImportedSection: some View {
    if showsAlreadyImported {
      Section {
        ForEach(alreadyImported) { item in
          Toggle(isOn: isReticked(item)) {
            Text(item.title).domaFont(.body)
          }
          .toggleStyle(PaprikaTickStyle())
        }
      } header: {
        Text("Already Brought In").domaFont(.supporting)
      } footer: {
        Text(PaprikaImportCopy.alreadyImportedFootnote)
          .domaFont(.supporting)
          .foregroundStyle(DomaColor.warmTextSecondary)
      }
      .listRowBackground(DomaColor.warmBgCard)
    } else if !alreadyImported.isEmpty {
      Section {
        Button(PaprikaImportCopy.showAlreadyImported(alreadyImported.count)) { showsAlreadyImported = true }
          .domaFont(.body)
      }
      .listRowBackground(DomaColor.warmBgCard)
    }
  }

  private func message(_ text: String, systemImage: String) -> some View {
    DomaStateView(title: text, systemImage: systemImage)
  }

  private func isTicked(_ item: DomaPaprikaImportItem) -> Binding<Bool> {
    Binding(
      get: { !unticked.contains(item.uid) },
      set: { if $0 { unticked.remove(item.uid) } else { unticked.insert(item.uid) } }
    )
  }

  private func isReticked(_ item: DomaPaprikaImportItem) -> Binding<Bool> {
    Binding(
      get: { reticked.contains(item.uid) },
      set: { if $0 { reticked.insert(item.uid) } else { reticked.remove(item.uid) } }
    )
  }

  private func load() async {
    do {
      preview = try await paprika.previewImport()
    } catch {
      loadFailed = true
    }
  }

  private func importTicked() async {
    guard !isImporting, !tickedUids.isEmpty || !reimportUids.isEmpty else { return }
    isImporting = true
    defer { isImporting = false }
    do {
      let result = try await paprika.importItems(
        uids: tickedUids, reimportUids: reimportUids, removeFromPaprika: removeFromPaprika)
      outcome = PaprikaImportCopy.outcome(result)
    } catch {
      outcome = (
        title: "Import didn't finish", message: "Couldn't reach Doma. Check the list before trying again.",
        isProblem: true
      )
    }
  }

  /// Closes after a successful import; a problem leaves the sheet up so the person can try again.
  private func finish() {
    let succeeded = outcome?.isProblem == false
    outcome = nil
    if succeeded { dismiss() }
  }
}

/// The list's own tick ring, so choosing items looks like ticking them.
private struct PaprikaTickStyle: ToggleStyle {
  @ScaledMetric(relativeTo: .body) private var checkSize = 22

  func makeBody(configuration: Configuration) -> some View {
    Button {
      configuration.isOn.toggle()
    } label: {
      HStack(spacing: 12) {
        DomaCheckbox(isChecked: configuration.isOn, size: checkSize)
        configuration.label.frame(maxWidth: .infinity, alignment: .leading)
      }
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityAddTraits(.isToggle)
    .accessibilityValue(configuration.isOn ? "Will be added" : "Won't be added")
  }
}
