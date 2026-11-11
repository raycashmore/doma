import AppIntents
import DomaKit
import WidgetKit

struct SelectListIntent: WidgetConfigurationIntent {
  static let title: LocalizedStringResource = "Choose a list"
  static let description = IntentDescription("The list this widget shows. Leave it empty for your default list.")

  @Parameter(title: "List")
  var list: ListEntity?
}

struct ListEntity: AppEntity {
  static let typeDisplayRepresentation: TypeDisplayRepresentation = "List"
  static let defaultQuery = ListEntityQuery()

  let id: String
  let name: String

  var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }
}

struct ListEntityQuery: EntityQuery {
  /// Resolves every configured list, even one that cannot be read or is no longer visible, so
  /// the widget says it is unavailable rather than quietly showing the default list. A placeholder
  /// name only shows while editing the widget.
  func entities(for identifiers: [String]) async throws -> [ListEntity] {
    let lists = (try? await visibleLists()) ?? []
    return identifiers.map { id in lists.first { $0.id == id } ?? ListEntity(id: id, name: "Unavailable list") }
  }

  func suggestedEntities() async throws -> [ListEntity] {
    try await visibleLists()
  }

  private func visibleLists() async throws -> [ListEntity] {
    let lists: [DomaListSummary] = try await WidgetSession.run("lists/queries:listVisibleToMe")
    return lists.map { ListEntity(id: $0.publicId, name: $0.name) }
  }
}
