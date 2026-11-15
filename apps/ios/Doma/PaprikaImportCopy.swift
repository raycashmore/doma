import DomaKit

/// What the Get Paprika Items sheet shows: items grouped by recipe, and the message for each outcome.
enum PaprikaImportCopy {
  struct RecipeGroup: Equatable, Identifiable {
    /// `nil` for items Paprika didn't add from a recipe.
    let recipe: String?
    let items: [DomaPaprikaImportItem]

    var id: String { recipe ?? "" }
    var title: String { recipe ?? "Other items" }
  }

  /// Recipes in the order Paprika lists them, with items not from a recipe last.
  static func groups(_ items: [DomaPaprikaImportItem]) -> [RecipeGroup] {
    var order: [String?] = []
    var byRecipe: [String?: [DomaPaprikaImportItem]] = [:]
    for item in items {
      if byRecipe[item.recipe] == nil { order.append(item.recipe) }
      byRecipe[item.recipe, default: []].append(item)
    }
    let recipes = order.filter { $0 != nil } + order.filter { $0 == nil }
    return recipes.map { RecipeGroup(recipe: $0, items: byRecipe[$0] ?? []) }
  }

  static let noGroceriesList = "Choose a Groceries list first: open a list's settings and tap Set as Groceries List."
  static let nothingNew = "Nothing new in Paprika. Items you've already brought in aren't shown again."
  static let removalFootnote = "Keeps Paprika's list tidy. Items already brought in are never added twice either way."

  /// Why the items couldn't be read, or `nil` when they were.
  static func previewProblem(_ preview: DomaPaprikaImportPreview) -> String? {
    switch preview {
    case .items: nil
    case .noGroceriesList: noGroceriesList
    case .failed(let failure): problem(failure)
    }
  }

  /// The alert after Import. `isProblem` is true when nothing was added.
  static func outcome(_ result: DomaPaprikaImportResult) -> (title: String, message: String, isProblem: Bool) {
    switch result {
    // Brought in elsewhere, or gone from Paprika, since the sheet opened.
    case .imported(count: 0, _, _): return (title: "Nothing was added", message: nothingNew, isProblem: false)
    case .imported(let count, let listName, let removal):
      let added = count == 1 ? "Added 1 item to \(listName)." : "Added \(count) items to \(listName)."
      return switch removal {
      case .removed, .kept: (title: "Items added", message: added, isProblem: false)
      case .failed:
        (
          title: "Items added",
          message: added + " They couldn't be removed from Paprika, but they won't be added again.",
          isProblem: false
        )
      }
    case .noGroceriesList: return (title: "Nothing was added", message: noGroceriesList, isProblem: true)
    case .failed(let failure): return (title: "Nothing was added", message: problem(failure), isProblem: true)
    }
  }

  private static func problem(_ failure: DomaPaprikaCallResult) -> String {
    switch failure {
    case .rejected: "Paprika stopped accepting Doma's sign-in. Reconnect from Lists > More > Paprika."
    case .notConnected, .connected: "Paprika isn't connected. Connect it from Lists > More > Paprika."
    case .unavailable(let httpStatus?): "Couldn't reach Paprika (HTTP \(httpStatus)). Nothing on your list changed."
    case .unavailable(nil): "Couldn't reach Paprika. Nothing on your list changed."
    }
  }
}
