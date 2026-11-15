import DomaKit
import SwiftUI

/// The noticeboard: what needs the household's attention today.
struct HomeView: View {
  let session: DomaSession
  @State private var board: DomaHomeBoard?
  @State private var loadFailed = false
  @State private var subscription = 0
  @State private var openItem: DomaBoardItem?
  @State private var editor: EditorRequest?
  /// A note to edit once its detail sheet has gone, since two sheets can't show at once.
  @State private var noteToEdit: DomaBoardNote?
  @State private var isShowingSettings = false
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  private struct EditorRequest: Identifiable {
    let id = UUID()
    let draft: ManualNoteDraft
  }

  private var timeZone: TimeZone { board.flatMap { TimeZone(identifier: $0.timeZone) } ?? .current }

  var body: some View {
    NavigationStack {
      content
        .domaHeaderedSheet(
          title: Text("Noticeboard"),
          kicker: board.map { Text(HomeBoardPresentation(board: $0).headerDate) })
        .toolbar {
          ToolbarItemGroup(placement: .topBarTrailing) {
            Button("Add note", systemImage: "plus") {
              editor = EditorRequest(draft: ManualNoteDraft(timeZone: timeZone))
            }
            Button("Settings", systemImage: "gearshape") { isShowingSettings = true }
          }
        }
    }
    .tint(DomaColor.warmTextPrimary)
    .task(id: subscription) {
      await followLiveQuery("Noticeboard", subscribe: session.home.board) {
        loadFailed = true
      } onValue: { value in
        board = value
        loadFailed = false
      }
    }
    .sheet(item: $openItem, onDismiss: openPendingEditor) { item in
      if let board {
        HomeCardDetailSheet(item: item, presentation: HomeBoardPresentation(board: board), home: session.home) {
          noteToEdit = $0
          openItem = nil
        }
      }
    }
    .sheet(item: $editor) { request in
      NoteEditorSheet(draft: request.draft, home: session.home)
    }
    .sheet(isPresented: $isShowingSettings) {
      SettingsSheet(session: session)
    }
  }

  @ViewBuilder
  private var content: some View {
    if let board {
      ScrollView {
        cards(HomeBoardPresentation(board: board))
          .padding(.horizontal, horizontalSizeClass == .regular ? 32 : 16)
          .padding(.vertical, 20)
      }
    } else if loadFailed {
      VStack(spacing: 12) {
        Text("Household noticeboard is unavailable")
          .domaFont(.sectionHeader)
          .foregroundStyle(DomaColor.warmTextPrimary)
        Button("Retry") {
          loadFailed = false
          subscription += 1
        }
        .domaFont(.button)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    } else {
      ProgressView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
  }

  @ViewBuilder
  private func cards(_ presentation: HomeBoardPresentation) -> some View {
    if horizontalSizeClass == .regular {
      VStack(alignment: .leading, spacing: 16) {
        BoardBentoLayout {
          ForEach(presentation.visibleCards) { item in
            card(item, presentation).bentoSize(BentoSize(for: item))
          }
        }
        if presentation.attentionCards.isEmpty { nothingElse(presentation) }
      }
    } else {
      LazyVStack(alignment: .leading, spacing: 12) {
        ForEach(presentation.leadCards) { card($0, presentation) }
        DomaSectionHeader(title: "Needs attention")
          .padding(.top, 12)
          .padding(.leading, 4)
        if presentation.attentionCards.isEmpty { nothingElse(presentation) }
        ForEach(presentation.attentionCards) { card($0, presentation) }
      }
    }
  }

  private func nothingElse(_ presentation: HomeBoardPresentation) -> some View {
    Text(
      presentation.leadCards.isEmpty
        ? "Nothing needs attention right now." : "Nothing else needs attention right now.")
      .domaFont(.supporting)
      .foregroundStyle(DomaColor.warmTextSecondary)
      .padding(.leading, 4)
  }

  private func card(_ item: DomaBoardItem, _ presentation: HomeBoardPresentation) -> some View {
    Button { openItem = item } label: {
      HomeCard(item: item, presentation: presentation)
    }
    .buttonStyle(.plain)
  }

  private func openPendingEditor() {
    guard let note = noteToEdit else { return }
    noteToEdit = nil
    editor = EditorRequest(draft: ManualNoteDraft(editing: note, timeZone: timeZone))
  }
}
