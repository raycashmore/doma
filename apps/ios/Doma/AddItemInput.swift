/// Reads one edit of the add field. SwiftUI cannot intercept a paste, so a paste is recognised as
/// one edit that inserts text parsing into two or more items, as the web treats a paste.
/// The field allows newlines so a pasted list keeps its lines; Return arrives as an inserted newline.
enum AddItemInput: Equatable {
  /// Ordinary typing: keep the text.
  case typed
  /// Return was pressed: add what the field holds, without the Return.
  case submit(String)
  /// Preview these items and put the field back as it was.
  case paste(PastedItems, restoring: String)

  init(from old: String, to new: String) {
    let edit = Edit(from: old, to: new)
    let parsed = PastedItems(parsing: edit.inserted)
    if parsed.items.count >= 2 {
      self = .paste(parsed, restoring: old)
    } else if edit.inserted.last?.isNewline == true {
      // Return, possibly arriving with an autocorrection in the same edit.
      self = .submit(edit.prefix + edit.inserted.trimmingTrailingNewlines + edit.suffix)
    } else {
      self = .typed
    }
  }

  /// The text between the parts the two versions share at each end.
  private struct Edit {
    let prefix: String
    let inserted: String
    let suffix: String

    init(from old: String, to new: String) {
      let prefixCount = zip(old, new).prefix { $0 == $1 }.count
      let maxSuffix = min(old.count, new.count) - prefixCount
      let suffixCount = zip(old.reversed(), new.reversed()).prefix(maxSuffix).prefix { $0 == $1 }.count
      prefix = String(new.prefix(prefixCount))
      inserted = String(new.dropFirst(prefixCount).dropLast(suffixCount))
      suffix = String(new.suffix(suffixCount))
    }
  }
}

private extension String {
  var trimmingTrailingNewlines: String {
    var text = self
    while text.last?.isNewline == true { text.removeLast() }
    return text
  }
}
