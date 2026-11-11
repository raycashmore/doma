import Foundation

/// Runs one Convex query over HTTP, for processes too short-lived for a live subscription,
/// such as the widget extension.
public struct DomaConvexHTTPQuery: Sendable {
  private let endpoint: URL
  private let session: URLSession

  public init?(deploymentURL: String, session: URLSession = .shared) {
    guard let base = URL(string: deploymentURL) else { return nil }
    endpoint = base.appending(path: "api/query")
    self.session = session
  }

  public func run<Value: Decodable>(_ path: String, args: [String: String], token: String) async throws -> Value {
    var request = URLRequest(url: endpoint)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.httpBody = try JSONEncoder().encode(Body(path: path, args: args, format: "json"))

    let (data, response) = try await session.data(for: request)
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    let outcome = try? JSONDecoder().decode(Outcome.self, from: data)
    guard status == 200, outcome?.status == "success" else {
      throw DomaConvexHTTPQueryError(status: status, message: outcome?.errorMessage)
    }
    return try JSONDecoder().decode(Success<Value>.self, from: data).value
  }

  private struct Body: Encodable {
    let path: String
    let args: [String: String]
    let format: String
  }

  private struct Outcome: Decodable {
    let status: String
    let errorMessage: String?
  }

  private struct Success<Value: Decodable>: Decodable {
    let value: Value
  }
}

public enum DomaConvexHTTPQueryError: Error, Equatable {
  /// Convex rejected the token, or the function found no signed-in user.
  case unauthenticated
  case failed(status: Int)

  /// Convex answers a token it cannot verify with 400 or 401, and a function that finds no
  /// identity with a 200 error naming it (`requireUserId` in `lists/items.ts`).
  public init(status: Int, message: String?) {
    if [400, 401, 403].contains(status) || message?.contains("Not authenticated") == true {
      self = .unauthenticated
    } else {
      self = .failed(status: status)
    }
  }
}
