import Combine
@preconcurrency import ConvexMobile

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

  enum CodingKeys: String, CodingKey {
    case id = "_id"
    case title
  }
}

public struct DomaListItems: Decodable, Equatable, Sendable {
  public let list: DomaListSummary
  public let activeItems: [DomaListItem]
  public let completedItems: [DomaListItem]
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

  public func complete(itemId: String) async throws {
    let _: IgnoredResult = try await convex.mutation("lists/mutations:completeListItem", with: ["itemId": itemId])
  }

  public func uncomplete(itemId: String) async throws {
    let _: IgnoredResult = try await convex.mutation("lists/mutations:uncompleteListItem", with: ["itemId": itemId])
  }
}

/// Accepts any mutation result; ConvexMobile's void overload only tolerates a string or null.
private struct IgnoredResult: Decodable {
  init(from decoder: any Decoder) throws {}
}
