import Combine
@preconcurrency import ConvexMobile
import Foundation

/// The signed-in person's Paprika connection. The server never sends the token.
public struct DomaPaprikaConnection: Decodable, Equatable, Sendable {
  public let status: Status
  public let groceryLists: [GroceryList]
  public let sourceListUid: String?
  /// `nil` when no Doma list is chosen, or the chosen one was deleted or is no longer visible.
  public let targetList: DomaDefaultList?

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
public enum DomaPaprikaCallResult: String, Decodable, Equatable, Sendable {
  case connected
  /// Paprika refused the email and password, or the stored sign-in.
  case rejected
  case unavailable
  case notConnected = "not_connected"

  private enum CodingKeys: String, CodingKey { case status }

  public init(from decoder: any Decoder) throws {
    let status = try decoder.container(keyedBy: CodingKeys.self).decode(String.self, forKey: .status)
    self = Self(rawValue: status) ?? .unavailable
  }
}

/// Typed wrappers for `packages/convex/convex/paprika/connection.ts`.
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

  public func setTargetList(publicId: String) async throws {
    let _: IgnoredResult = try await convex.mutation(
      "paprika/connection:setTargetList", with: ["publicId": publicId])
  }

  public func disconnect() async throws {
    let _: IgnoredResult = try await convex.mutation("paprika/connection:disconnect")
  }
}
