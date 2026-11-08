/// Reads one edit of the add field. SwiftUI cannot intercept a paste, so a paste is recognised as
/// one edit that inserts text parsing into two or more items, as the web treats a paste.
/// The field allows newlines so a pasted list keeps its lines; Return arrives as an inserted newline.
enum AddItemInput: Equatable {
  /// Ordinary typing: keep the text.
  case typed
  /// Show the text instead, with stray newlines turned into spaces.
  case replace(String)
  /// Return was pressed: add this title.
  case submit(String)
  /// Preview these items and put the field back as it was.
  case paste(PastedItems, restoring: String)

  init(from old: String, to new: String) {
    let inserted = Self.insertedText(from: old, to: new)
    let parsed = PastedItems(parsing: inserted)
    if parsed.items.count >= 2 {
      self = .paste(parsed, restoring: old)
    } else if inserted.last?.isNewline == true {
      // Return, possibly arriving with an autocorrection in the same edit.
      self = .submit(new.filter { !$0.isNewline })
    } else if new.contains(where: \.isNewline) {
      self = .replace(new.split(whereSeparator: \.isNewline).joined(separator: " "))
    } else {
      self = .typed
    }
  }

  /// The text between the parts the two versions share at each end.
  private static func insertedText(from old: String, to new: String) -> String {
    let prefix = zip(old, new).prefix { $0 == $1 }.count
    let maxSuffix = min(old.count, new.count) - prefix
    let suffix = zip(old.reversed(), new.reversed()).prefix(maxSuffix).prefix { $0 == $1 }.count
    return String(new.dropFirst(prefix).dropLast(suffix))
  }
}
