import Combine
@preconcurrency import ConvexMobile
import Foundation

/// The signed-in person's Paprika connection. The server never sends the token.
public struct DomaPaprikaConnection: Decodable, Equatable, Sendable {
  public let status: Status
  public let groceryLists: [GroceryList]
  public let sourceListUid: String?
  /// Where items go: the person's Groceries list, or `nil` when they have none.
  public let groceriesList: DomaDefaultList?

  public enum Status: String, Decodable, Sendable {
    case connected
    /// Paprika refused the stored sign-in; the person signs in again.
    case needsReconnect = "needs_reconnect"
  }

  public struct GroceryList: Decodable, Equatable, Identifiable, Sendable {
    public let uid: String
    public let name: String

    public var id: String { uid }
  }
}

/// What a call to Paprika reports. Paprika's own outcomes never throw.
public enum DomaPaprikaCallResult: Decodable, Equatable, Sendable {
  case connected
  /// Paprika itself refused the email and password, or the stored sign-in. `reason` is Paprika's message.
  case rejected(reason: String?)
  /// No usable reply. `httpStatus` is set when something answered, such as a firewall blocking Doma's server.
  case unavailable(httpStatus: Int?)
  case notConnected

  private enum CodingKeys: String, CodingKey { case status, reason, httpStatus }

  public init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    switch try container.decode(String.self, forKey: .status) {
    case "connected": self = .connected
    case "rejected": self = .rejected(reason: try container.decodeIfPresent(String.self, forKey: .reason))
    case "not_connected": self = .notConnected
    default: self = .unavailable(httpStatus: (try container.decodeIfPresent(Double.self, forKey: .httpStatus)).map { Int($0) })
    }
  }
}

/// A Paprika item the person can bring into their Groceries list.
public struct DomaPaprikaImportItem: Decodable, Equatable, Identifiable, Sendable {
  public let uid: String
  /// Paprika's full line, such as "100g frozen spinach".
  public let title: String
  public let recipe: String?

  public var id: String { uid }
}

/// Paprika's items that are still to buy and not yet imported, or why they couldn't be read.
public enum DomaPaprikaImportPreview: Decodable, Equatable, Sendable {
  case items([DomaPaprikaImportItem])
  /// The person has no Groceries list to bring items into.
  case noGroceriesList
  case failed(DomaPaprikaCallResult)

  private enum CodingKeys: String, CodingKey { case status, items }

  public init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    switch try container.decode(String.self, forKey: .status) {
    case "ok": self = .items(try container.decode([DomaPaprikaImportItem].self, forKey: .items))
    case "no_groceries_list": self = .noGroceriesList
    default: self = .failed(try DomaPaprikaCallResult(from: decoder))
    }
  }
}

/// What an import did.
public enum DomaPaprikaImportResult: Decodable, Equatable, Sendable {
  case imported(count: Int, listName: String, removal: Removal)
  /// The person has no Groceries list, so nothing was added or removed.
  case noGroceriesList
  /// Paprika couldn't be read, so nothing changed.
  case failed(DomaPaprikaCallResult)

  public enum Removal: String, Decodable, Sendable {
    case removed
    /// The person chose to keep the items in Paprika.
    case kept
    /// The items were added to Doma but are still in Paprika. They won't be imported again.
    case failed
  }

  private enum CodingKeys: String, CodingKey { case status, count, listName, removal }

  public init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    switch try container.decode(String.self, forKey: .status) {
    case "imported":
      self = .imported(
        count: Int(try container.decode(Double.self, forKey: .count)),
        listName: try container.decode(String.self, forKey: .listName),
        removal: try container.decode(Removal.self, forKey: .removal)
      )
    case "no_groceries_list": self = .noGroceriesList
    default: self = .failed(try DomaPaprikaCallResult(from: decoder))
    }
  }
}

/// Typed wrappers for `packages/convex/convex/paprika/connection.ts` and `importActions.ts`.
public struct DomaPaprikaClient: Sendable {
  private let convex: ConvexClient

  public init(convex: ConvexClient) {
    self.convex = convex
  }

  /// Publishes `nil` until the person connects Paprika.
  public func connection() -> AnyPublisher<DomaPaprikaConnection?, ClientError> {
    convex.subscribe(to: "paprika/connection:getConnection")
  }

  /// Signs in to Paprika once. The password goes to Doma's server for this call only and is not stored.
  public func connect(email: String, password: String) async throws -> DomaPaprikaCallResult {
    try await convex.action("paprika/connection:connect", with: ["email": email, "password": password])
  }

  /// One call to Paprika with the stored sign-in, which also refreshes its list names.
  public func checkConnection() async throws -> DomaPaprikaCallResult {
    try await convex.action("paprika/connection:checkConnection")
  }

  public func setSourceList(uid: String) async throws {
    let _: IgnoredResult = try await convex.mutation("paprika/connection:setSourceList", with: ["uid": uid])
  }

  /// One read of Paprika's grocery items.
  public func previewImport() async throws -> DomaPaprikaImportPreview {
    try await convex.action("paprika/importActions:previewImport")
  }

  /// Adds the chosen items to the Groceries list, then removes them from Paprika when asked.
  public func importItems(uids: [String], removeFromPaprika: Bool) async throws -> DomaPaprikaImportResult {
    try await convex.action(
      "paprika/importActions:importItems",
      // ConvexMobile encodes arrays of optional values.
      with: ["uids": uids.map { $0 as ConvexEncodable? }, "removeFromPaprika": removeFromPaprika])
  }

  public func disconnect() async throws {
    let _: IgnoredResult = try await convex.mutation("paprika/connection:disconnect")
  }
}
