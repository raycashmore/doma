import Foundation

/// A port of the web's `paste-parser.ts`. `PastedItemsTests` repeats its cases, so keep the two in step.
struct PastedItems: Equatable {
  struct Entry: Equatable, Hashable {
    enum Kind { case item, heading }

    let kind: Kind
    let text: String
  }

  let entries: [Entry]

  var items: [String] { entries.filter { $0.kind == .item }.map(\.text) }
  var headings: [String] { entries.filter { $0.kind == .heading }.map(\.text) }

  // Leading list markers: checkbox glyphs, bullets, and numbered prefixes.
  private static let leadingMarker = pattern(#"^\s*(?:[-*•·–—]|[☐☑☒✓✔]|\d+[.)])\s*"#)
  // Checkbox glyphs split even when glued to the next word ("☐milk").
  private static let beforeGlyph = pattern(#"\s*(?=[☐☑☒✓✔])"#)
  // Bullets and numbers split only when whitespace-bounded, so "Milk, 2L" and "low-fat" stay whole.
  private static let beforeMarker = pattern(#"\s+(?=(?:[-*•·–—]|\d+[.)])\s)"#)
  private static let trailingPunctuation = pattern(#"[,;]+$"#)

  init(parsing text: String) {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      entries = []
      return
    }

    // Newlines, real or added before inline markers, take precedence over commas.
    let lineSource = Self.breakBeforeInlineMarkers(trimmed)
    if lineSource.contains(where: \.isNewline) {
      entries = Self.parseLines(lineSource)
      return
    }

    // A flat line splits on commas only with at least two, so "Milk, 2L" stays one item.
    if trimmed.filter({ $0 == "," }).count >= 2 {
      entries = trimmed.split(separator: ",", omittingEmptySubsequences: false)
        .map { Self.normalize(String($0)) }
        .filter { !$0.isEmpty }
        .map { Entry(kind: .item, text: $0) }
      return
    }

    entries = [Entry(kind: .item, text: trimmed)]
  }

  private static func breakBeforeInlineMarkers(_ text: String) -> String {
    replacing(beforeMarker, in: replacing(beforeGlyph, in: text, with: "\n"), with: "\n")
  }

  /// When some lines carry a marker, the unmarked ones are headings; in a plain list every line is an item.
  private static func parseLines(_ source: String) -> [Entry] {
    let lines = source.components(separatedBy: .newlines)
      .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
    let anyMarked = lines.contains(where: isMarked)
    return lines.compactMap { line in
      let text = normalize(line)
      guard !text.isEmpty else { return nil }
      return Entry(kind: anyMarked && !isMarked(line) ? .heading : .item, text: text)
    }
  }

  private static func isMarked(_ line: String) -> Bool {
    leadingMarker.firstMatch(in: line, range: NSRange(line.startIndex..., in: line)) != nil
  }

  /// Strips a leading marker and the commas or semicolons a delimited paste leaves behind.
  private static func normalize(_ line: String) -> String {
    replacing(trailingPunctuation, in: replacing(leadingMarker, in: line, with: ""), with: "")
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private static func pattern(_ source: String) -> NSRegularExpression {
    // Literal patterns, so a failure is a programming error caught by the tests.
    try! NSRegularExpression(pattern: source)
  }

  private static func replacing(_ regex: NSRegularExpression, in text: String, with template: String) -> String {
    regex.stringByReplacingMatches(in: text, range: NSRange(text.startIndex..., in: text), withTemplate: template)
  }
}
