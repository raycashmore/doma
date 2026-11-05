import Combine
@preconcurrency import ConvexMobile
import Foundation

public struct DomaListSummary: Decodable, Hashable, Identifiable, Sendable {
  public let publicId: String
  public let name: String
  public let visibility: Visibility

  public var id: String { publicId }

  public enum Visibility: String, Decodable, Hashable, Sendable {
    case personal
    case shared
  }
}

public struct DomaListItem: Decodable, Equatable, Identifiable, Sendable {
  public let id: String
  public let title: String
  public let notes: String?
  public let propertyValues: [DomaListItemPropertyValue]

  enum CodingKeys: String, CodingKey {
    case id = "_id"
    case title
    case notes
    case propertyValues
  }
}

/// A stored value. Only the field matching the property's kind is set.
public struct DomaListItemPropertyValue: Decodable, Equatable, Sendable {
  public let propertyId: String
  public let textValue: String?
  public let numberValue: Double?
  /// Milliseconds since 1970, as Convex stores it.
  public let dateValue: Double?
  public let selectOptionId: String?
  public let checkboxValue: Bool?

  public var date: Date? { dateValue.map { Date(timeIntervalSince1970: $0 / 1000) } }

  enum CodingKeys: String, CodingKey {
    case propertyId = "listPropertyId"
    case textValue
    case numberValue
    case dateValue
    case selectOptionId
    case checkboxValue
  }
}

public struct DomaListProperty: Decodable, Equatable, Identifiable, Sendable {
  public let id: String
  public let name: String
  public let kind: Kind
  public let options: [Option]?

  public enum Kind: String, Decodable, Sendable {
    case text
    case number
    case date
    case select
    case checkbox
  }

  public struct Option: Decodable, Equatable, Identifiable, Sendable {
    public let id: String
    public let label: String
  }

  enum CodingKeys: String, CodingKey {
    case id = "_id"
    case name
    case kind = "type"
    case options
  }
}

/// A value to save, matching the union `setListItemPropertyValue` accepts.
public enum DomaListPropertyValue: Equatable, Sendable {
  case text(String)
  case number(Double)
  case date(Date)
  case select(optionId: String)
  case checkbox(Bool)

  var convexValue: [String: ConvexEncodable?] {
    switch self {
    case .text(let text): ["type": "text", "text": text]
    case .number(let number): ["type": "number", "number": number]
    case .date(let date): ["type": "date", "date": date.timeIntervalSince1970 * 1000]
    case .select(let optionId): ["type": "select", "optionId": optionId]
    case .checkbox(let checked): ["type": "checkbox", "checked": checked]
    }
  }
}

public struct DomaListItems: Decodable, Equatable, Sendable {
  public let list: DomaListSummary
  public let properties: [DomaListProperty]
  public let activeItems: [DomaListItem]
  public let completedItems: [DomaListItem]
}

public struct DomaDefaultList: Decodable, Equatable, Sendable {
  public let publicId: String
  public let name: String
}

public struct DomaWidgetSnapshot: Decodable, Equatable, Sendable {
  public struct Item: Decodable, Equatable, Sendable {
    public let id: String
    public let title: String
  }

  public let list: DomaListSummaryReference
  public let activeItems: [Item]
}

public struct DomaListSummaryReference: Decodable, Equatable, Sendable {
  public let publicId: String
  public let name: String
  public let slug: String
}

/// Typed wrappers for the Convex Lists functions the iOS app uses.
/// Function names and argument keys mirror `packages/convex/convex/lists`.
public struct DomaListsClient: Sendable {
  private let convex: ConvexClient

  public init(convex: ConvexClient) {
    self.convex = convex
  }

  public func visibleLists() -> AnyPublisher<[DomaListSummary], ClientError> {
    convex.subscribe(to: "lists/queries:listVisibleToMe")
  }

  /// Publishes `nil` when the list is missing or not visible to the signed-in account.
  public func items(listPublicId: String) -> AnyPublisher<DomaListItems?, ClientError> {
    convex.subscribe(to: "lists/queries:getVisibleListItemsByPublicId", with: ["publicId": listPublicId])
  }

  public func widgetSnapshot(listPublicId: String) -> AnyPublisher<DomaWidgetSnapshot?, ClientError> {
    convex.subscribe(to: "lists/widget:getSnapshot", with: ["publicId": listPublicId])
  }

  /// Publishes `nil` when no default is set, or the default list is gone or no longer visible.
  public func defaultList() -> AnyPublisher<DomaDefaultList?, ClientError> {
    convex.subscribe(to: "lists/queries:getDefaultList")
  }

  /// Returns the new list's public ID.
  public func createList(name: String, visibility: DomaListSummary.Visibility) async throws -> String {
    let created: CreatedList = try await convex.mutation(
      "lists/mutations:createList", with: ["name": name, "visibility": visibility.rawValue])
    return created.publicId
  }

  public func renameList(publicId: String, name: String) async throws {
    let _: IgnoredResult = try await convex.mutation(
      "lists/mutations:renameList", with: ["publicId": publicId, "name": name])
  }

  public func deleteList(publicId: String) async throws {
    let _: IgnoredResult = try await convex.mutation("lists/mutations:deleteList", with: ["publicId": publicId])
  }

  public func setDefaultList(publicId: String) async throws {
    let _: IgnoredResult = try await convex.mutation("lists/bot:setDefaultList", with: ["publicId": publicId])
  }

  public func createItem(listPublicId: String, title: String) async throws {
    let _: IgnoredResult = try await convex.mutation(
      "lists/mutations:createListItem", with: ["listPublicId": listPublicId, "title": title])
  }

  public func renameItem(itemId: String, title: String) async throws {
    let _: IgnoredResult = try await convex.mutation(
      "lists/mutations:renameListItem", with: ["itemId": itemId, "title": title])
  }

  /// Empty notes clear the field.
  public func setItemNotes(itemId: String, notes: String) async throws {
    let _: IgnoredResult = try await convex.mutation(
      "lists/mutations:setListItemNotes", with: ["itemId": itemId, "notes": notes])
  }

  public func setItemPropertyValue(
    itemId: String, propertyId: String, value: DomaListPropertyValue
  ) async throws {
    let _: IgnoredResult = try await convex.mutation(
      "lists/mutations:setListItemPropertyValue",
      with: ["itemId": itemId, "propertyId": propertyId, "value": value.convexValue])
  }

  public func clearItemPropertyValue(itemId: String, propertyId: String) async throws {
    let _: IgnoredResult = try await convex.mutation(
      "lists/mutations:clearListItemPropertyValue", with: ["itemId": itemId, "propertyId": propertyId])
  }

  public func deleteItem(itemId: String) async throws {
    let _: IgnoredResult = try await convex.mutation("lists/mutations:deleteListItem", with: ["itemId": itemId])
  }

  /// `targetIndex` is the item's position in the new active order. It is sent as a Double because
  /// ConvexMobile encodes Swift integers as int64, which `v.number()` rejects.
  public func reorderItem(itemId: String, targetIndex: Int) async throws {
    let _: IgnoredResult = try await convex.mutation(
      "lists/mutations:reorderListItem", with: ["itemId": itemId, "targetIndex": Double(targetIndex)])
  }

  public func clearCompletedItems(listPublicId: String) async throws {
    let _: IgnoredResult = try await convex.mutation(
      "lists/mutations:clearCompletedListItems", with: ["listPublicId": listPublicId])
  }

  public func complete(itemId: String) async throws {
    let _: IgnoredResult = try await convex.mutation("lists/mutations:completeListItem", with: ["itemId": itemId])
  }

  public func uncomplete(itemId: String) async throws {
    let _: IgnoredResult = try await convex.mutation("lists/mutations:uncompleteListItem", with: ["itemId": itemId])
  }
}

private struct CreatedList: Decodable {
  let publicId: String
}

/// Accepts any mutation result; ConvexMobile's void overload only tolerates a string or null.
private struct IgnoredResult: Decodable {
  init(from decoder: any Decoder) throws {}
}
