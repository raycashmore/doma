import DomaKit
import Foundation
import Testing

@testable import Doma

@MainActor
struct HomeBoardTests {
  /// Shaped like `home/activeBoard:activeBoard` on 15 November 2026, with placeholder content.
  private static let boardJSON = #"""
    {"localDate":"2026-11-15","timeZone":"Australia/Sydney","items":[
      {"kind":"today","id":"today:2026-11-15","sourceKind":"today","sourceApp":"schedule","destination":"/schedule",
       "briefingStatus":"available","headline":"Swimming, then a quiet afternoon","generatedAt":1794691800000,
       "morning":[{"text":"swimming bag","who":["Child A"],"sourceIds":["event-1"]}],
       "laterToday":[{"id":"event-2","title":"Dentist","start":1794725100000,"end":1794727800000,"allDay":false,
         "who":["Adult B"],"destination":"/schedule"}],
       "watchouts":[{"text":"Bins go out tonight","who":[],"sourceIds":[]}]},
      {"kind":"meals","id":"meals:2026-11-15","sourceKind":"meals","sourceApp":"meals","destination":"/meals",
       "schoolLunch":"Chicken wraps","dinner":null},
      {"kind":"manualNote","id":"manualNote:n1","noteId":"n1","sourceKind":"manualNote","sourceApp":"home",
       "display":"wide","priority":"high","title":"Return the form","dueDate":"2026-11-13","dueState":"overdue",
       "authorUserId":"user","createdAt":1,"updatedAt":2},
      {"kind":"sourceNotice","id":"emailNotice:e1","sourceKind":"forwardedEmail","sourceApp":"home","display":"standard",
       "priority":"medium","title":"Excursion","detail":"Sign and pay","facts":[{"label":"From","value":"School office"}],
       "dueDate":"2026-11-17","dueState":"upcoming","obligationAction":"pay","occurredAt":1794363120000,
       "destination":"/notices/e1"},
      {"kind":"sourceNotice","id":"spendingInsight:2026-09","sourceKind":"monthlySpendingInsight","sourceApp":"budget",
       "display":"standard","priority":"medium","title":"This month, spending was a bit higher.",
       "detail":"Groceries rose.","occurredAt":1,"period":"2026-09","destination":"/budget"},
      {"kind":"someFutureCard","id":"future:1"}
    ]}
    """#

  private func board(_ json: String = boardJSON) throws -> DomaHomeBoard {
    try JSONDecoder().decode(DomaHomeBoard.self, from: Data(json.utf8))
  }

  private func replacing(_ old: String, with new: String) -> String {
    Self.boardJSON.replacingOccurrences(of: old, with: new)
  }

  @Test func decodesEveryKindAndSkipsUnknownOnes() throws {
    let board = try board()
    #expect(board.items.map(\.id) == [
      "today:2026-11-15", "meals:2026-11-15", "manualNote:n1", "emailNotice:e1", "spendingInsight:2026-09",
    ])
    #expect(board.items.map(\.archiveSourceKind) == [
      "today", "meals", "manualNote", "forwardedEmail", "monthlySpendingInsight",
    ])
    guard case .meals(let meals) = board.items[1] else { Issue.record("expected meals"); return }
    #expect(meals.schoolLunch == "Chicken wraps")
    #expect(meals.dinner == nil)
  }

  @Test func hidesMealsWhenNothingIsPlanned() throws {
    let presentation = HomeBoardPresentation(
      board: try board(replacing(#""schoolLunch":"Chicken wraps""#, with: #""schoolLunch":null"#)))
    #expect(!presentation.visibleCards.map(\.id).contains("meals:2026-11-15"))
  }

  private func todayOnly(status: String, laterToday: String) throws -> HomeBoardPresentation {
    HomeBoardPresentation(
      board: try board(
        #"""
        {"localDate":"2026-11-15","timeZone":"Australia/Sydney","items":[
          {"kind":"today","id":"today:2026-11-15","briefingStatus":"\#(status)","headline":"Today",
           "generatedAt":null,"morning":[],"laterToday":[\#(laterToday)],"watchouts":[]}]}
        """#))
  }

  @Test func hidesTodayWithoutABriefingOrAnythingLater() throws {
    let event = #"{"id":"e","title":"Dentist","start":1,"end":2,"allDay":false,"who":[]}"#
    #expect(try todayOnly(status: "missing", laterToday: "").leadCards.isEmpty)
    #expect(try todayOnly(status: "empty", laterToday: "").leadCards.isEmpty)
    #expect(try todayOnly(status: "missing", laterToday: event).leadCards.count == 1)
    #expect(try todayOnly(status: "available", laterToday: "").leadCards.count == 1)
  }

  @Test func wordsKickersAndTitlesForTheHousehold() throws {
    let presentation = HomeBoardPresentation(board: try board())
    let items = presentation.board.items
    #expect(presentation.headerDate == "Sunday 15 November")
    #expect(presentation.kicker(for: items[2]) == "Overdue · Fri 13 Nov")
    #expect(presentation.kicker(for: items[3]) == "Due Tue 17 Nov")
    #expect(presentation.isUrgent(items[2]))
    #expect(!presentation.isUrgent(items[3]))
    guard case .spendingInsight(let insight) = items[4] else { Issue.record("expected insight"); return }
    #expect(presentation.spendingTitle(insight) == "September spending")
    let lastYear = HomeBoardPresentation(board: try board(replacing(#""period":"2026-09""#, with: #""period":"2025-12""#)))
    guard case .spendingInsight(let older) = lastYear.board.items[4] else { Issue.record("expected insight"); return }
    #expect(lastYear.spendingTitle(older) == "December 2025 spending")
  }

  @Test func listsTodayInBriefingOrder() throws {
    let presentation = HomeBoardPresentation(board: try board())
    guard case .today(let today) = presentation.board.items[0] else { Issue.record("expected today"); return }
    let lines = presentation.todayLines(today)
    #expect(lines.map(\.label) == ["Morning", "Afternoon", "Watch out"])
    #expect(lines[0].text == "Child A — swimming bag")
    #expect(lines[1].text.hasPrefix("Adult B — Dentist · "))
  }

  @Test func noteDraftChecksTheServerLimits() {
    let sydney = TimeZone(identifier: "Australia/Sydney")!
    var draft = ManualNoteDraft(timeZone: sydney)
    #expect(draft.problem == "Add a title.")
    draft.title = "  Plumber Tuesday  "
    #expect(draft.problem == nil)
    #expect(draft.trimmedTitle == "Plumber Tuesday")
    draft.title = String(repeating: "a", count: 81)
    #expect(draft.problem != nil)
    draft.title = "Plumber"
    draft.detail = String(repeating: "b", count: 1_001)
    #expect(draft.problem != nil)
    draft.detail = "   "
    #expect(draft.trimmedDetail == nil)
    // The server counts UTF-16 units, so 41 emoji are 82 and too long.
    draft.title = String(repeating: "🧺", count: 41)
    #expect(draft.problem != nil)
    draft.title = String(repeating: "🧺", count: 40)
    #expect(draft.problem == nil)
  }

  @Test func bentoFillsRowsLikeTheWebBoard() {
    let today = BentoSize(weight: 2, basis: 520, narrowBasis: 420)
    let note = BentoSize(weight: 1, basis: 300, narrowBasis: 300)
    let spending = BentoSize(weight: 2, basis: 600, narrowBasis: 480)
    let sizes = [today, note, spending]

    // iPad landscape: Today and the note share a row, by weight; spending wraps and fills its row.
    let landscape = BentoRows.rows(of: sizes, width: 1130, spacing: 16)
    #expect(landscape.map { $0.map(\.index) } == [[0, 1], [2]])
    // 1130 − 16 − 520 − 300 = 294 pt to share, two thirds to Today.
    let expected: [CGFloat] = [716, 398]
    #expect(landscape[0].map(\.width) == expected)
    #expect(landscape[1].map(\.width) == [1130])

    // iPad portrait uses the web's narrower bases, so Today and the note still fit together.
    let portrait = BentoRows.rows(of: sizes, width: 770, spacing: 16)
    #expect(portrait.map { $0.map(\.index) } == [[0, 1], [2]])

    // A lone card wider than the row shrinks to fit it.
    #expect(BentoRows.rows(of: [today], width: 358, spacing: 16) == [[BentoRows.Card(index: 0, width: 358)]])
  }

  @Test func noteDraftKeepsTheSavedDueDay() throws {
    let sydney = TimeZone(identifier: "Australia/Sydney")!
    let board = try board()
    guard case .note(let note) = board.items[2] else { Issue.record("expected note"); return }
    var draft = ManualNoteDraft(editing: note, timeZone: sydney)
    #expect(draft.hasDueDate)
    #expect(draft.dueDateValue == "2026-11-13")
    draft.hasDueDate = false
    #expect(draft.dueDateValue == nil)
  }
}
