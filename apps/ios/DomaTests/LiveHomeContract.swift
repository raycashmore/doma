@preconcurrency import ConvexMobile
import Foundation
import Testing

import DomaKit

extension LiveListsContractTests {
  /// Writes, edits and archives a fixture note through `DomaHomeClient`, so the noticeboard's
  /// Swift models and arguments are checked against Convex. Notes cannot be deleted, so the
  /// archived fixture note stays in the development deployment.
  func checkNoticeboardNote(on convex: ConvexClient) async throws {
    let home = DomaHomeClient(convex: convex)
    let title = "iOS fixture note \(UUID().uuidString.prefix(8))"
    let boards = LiveValues(home.board())
    _ = try await boards.next("noticeboard") { _ in true }

    try await home.createNote(title: title, detail: "Fixture detail", dueDate: "2026-01-02")
    let created = try await boards.next("created note") { board in
      board.items.contains { if case .note(let note) = $0 { note.title == title } else { false } }
    }
    let note = try #require(
      created.items.lazy.compactMap { if case .note(let note) = $0, note.title == title { note } else { nil } }.first)
    #expect(note.detail == "Fixture detail")
    #expect(note.dueDate == "2026-01-02")
    #expect(note.dueState == .overdue)

    // Leaving out the detail and due date clears them.
    try await home.updateNote(noteId: note.noteId, title: title, detail: nil, dueDate: nil)
    _ = try await boards.next("cleared note") { board in
      board.items.contains { if case .note(let edited) = $0 { edited.id == note.id && edited.detail == nil && edited.dueDate == nil } else { false } }
    }

    try await home.archive(.note(note))
    _ = try await boards.next("archived note") { board in !board.items.contains { $0.id == note.id } }
  }
}
