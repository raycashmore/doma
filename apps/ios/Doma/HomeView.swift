import DomaKit
import SwiftUI

/// The noticeboard: what needs the household's attention today.
struct HomeView: View {
  let session: DomaSession
  @State private var board: DomaHomeBoard?
  @State private var loadFailed = false
  /// The current minute, set on appear, each minute and on return to the app; Retry moves it on.
  /// The server works out today, what is overdue and what is still to come when the query runs, and
  /// Convex reuses a result until its data or arguments change. A token from the clock never repeats
  /// an old one (the web counts from 0), so the board is at most a minute behind.
  @State private var refreshToken = HomeView.currentMinute()
  @State private var openItem: DomaBoardItem?
  @State private var editor: EditorRequest?
  /// A note to edit once its detail sheet has gone, since two sheets can't show at once.
  @State private var noteToEdit: DomaBoardNote?
  @State private var isShowingSettings = false
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Environment(\.scenePhase) private var scenePhase

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
            // The household's time zone comes with the board.
            .disabled(board == nil)
            Button("Settings", systemImage: "gearshape") { isShowingSettings = true }
          }
        }
    }
    .tint(DomaColor.warmTextPrimary)
    .onAppear { refreshToken = Self.currentMinute() }
    .task(id: refreshToken) {
      await followLiveQuery("Noticeboard", subscribe: { session.home.board(refreshToken: Double(refreshToken)) }) {
        loadFailed = true
      } onValue: { value in
        board = value
        loadFailed = false
        // Archived elsewhere, or a new day began: its detail has nothing left to show.
        if let open = openItem, !value.items.contains(where: { $0.id == open.id }) { openItem = nil }
      }
    }
    .task {
      while !Task.isCancelled {
        try? await Task.sleep(for: .seconds(60))
        refreshToken = Self.currentMinute()
      }
    }
    .onChange(of: scenePhase) { _, phase in
      if phase == .active { refreshToken = Self.currentMinute() }
    }
    .sheet(item: $openItem, onDismiss: openPendingEditor) { item in
      if let board {
        // The live item, so an edit made elsewhere shows here and Edit starts from it.
        HomeCardDetailSheet(
          item: board.items.first { $0.id == item.id } ?? item, presentation: HomeBoardPresentation(board: board),
          home: session.home
        ) {
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
        Button {
          loadFailed = false
          refreshToken += 1
        } label: {
          Text("Retry")
            .domaFont(.button)
            .frame(minWidth: 88, minHeight: 44)
            .contentShape(.rect)
        }
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

  private static func currentMinute() -> Int {
    Int(Date.now.timeIntervalSince1970 / 60)
  }

  private func openPendingEditor() {
    guard let note = noteToEdit else { return }
    noteToEdit = nil
    editor = EditorRequest(draft: ManualNoteDraft(editing: note, timeZone: timeZone))
  }
}
