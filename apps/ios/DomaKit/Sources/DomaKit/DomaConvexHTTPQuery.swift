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
      throw DomaConvexHTTPQueryError.failed(status: status, message: outcome?.errorMessage)
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
  case failed(status: Int, message: String?)
}
