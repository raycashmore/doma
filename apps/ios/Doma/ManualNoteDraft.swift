import DomaKit
import Foundation

/// A shared note being written or edited, checked against the same limits as
/// `packages/convex/convex/home/manualNotes.ts`.
struct ManualNoteDraft: Equatable {
  static let titleLimit = 80
  static let detailLimit = 1_000

  var title = ""
  var detail = ""
  var hasDueDate = false
  /// Shown in the household's time zone, so the day picked is the day saved.
  var dueDate: Date
  /// Set when editing an existing note.
  let noteId: String?
  let timeZone: TimeZone

  init(timeZone: TimeZone, now: Date = .now) {
    self.timeZone = timeZone
    noteId = nil
    dueDate = now
  }

  init(editing note: DomaBoardNote, timeZone: TimeZone, now: Date = .now) {
    self.timeZone = timeZone
    noteId = note.noteId
    title = note.title
    detail = note.detail ?? ""
    let saved = note.dueDate.flatMap { Self.date(fromCalendarDay: $0, in: timeZone) }
    hasDueDate = saved != nil
    dueDate = saved ?? now
  }

  var trimmedTitle: String { title.trimmingCharacters(in: .whitespacesAndNewlines) }
  var trimmedDetail: String? {
    let trimmed = detail.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }

  /// Why the note can't be saved yet, or `nil` when it can. Lengths are counted in UTF-16 units,
  /// as the server's JavaScript `length` counts them, so an emoji counts as two.
  var problem: String? {
    if trimmedTitle.isEmpty { return "Add a title." }
    if trimmedTitle.utf16.count > Self.titleLimit { return "Keep the title to \(Self.titleLimit) characters." }
    if (trimmedDetail?.utf16.count ?? 0) > Self.detailLimit {
      return "Keep the detail to \(Self.detailLimit) characters."
    }
    return nil
  }

  /// `YYYY-MM-DD` in the household's time zone, or `nil` without a due date.
  var dueDateValue: String? {
    guard hasDueDate else { return nil }
    let parts = calendar.dateComponents([.year, .month, .day], from: dueDate)
    guard let year = parts.year, let month = parts.month, let day = parts.day else { return nil }
    return String(format: "%04d-%02d-%02d", year, month, day)
  }

  private var calendar: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    return calendar
  }

  private static func date(fromCalendarDay day: String, in timeZone: TimeZone) -> Date? {
    let parts = day.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3 else { return nil }
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12))
  }
}
