/// What the add field adds when submitted: one item per line and per comma, so "milk, eggs"
/// adds two. Unlike a paste, a single comma splits too, because typing a list is deliberate.
enum SubmittedItems {
  static func titles(in text: String) -> [String] {
    PastedItems(parsing: text).entries
      .flatMap { $0.text.split(separator: ",") }
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
  }
}
