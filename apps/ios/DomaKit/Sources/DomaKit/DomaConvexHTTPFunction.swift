import Foundation

/// Runs one Convex function over HTTP, for processes too short-lived for a live subscription, such
/// as the widget extension, and for calls made before the app has a Convex sign-in.
///
/// Request and response bodies can carry secrets (a device secret, a token), so neither is ever put
/// into an error or a log: errors carry only the HTTP status.
public struct DomaConvexHTTPFunction: Sendable {
  public enum Kind: String, Sendable {
    case query
    case mutation
    case action
  }

  private let endpoint: URL
  private let session: URLSession

  public init?(deploymentURL: String, kind: Kind, session: URLSession = .shared) {
    guard let base = URL(string: deploymentURL) else { return nil }
    endpoint = base.appending(path: "api/\(kind.rawValue)")
    self.session = session
  }

  public nonisolated(nonsending) func run<Value: Decodable, Args: Encodable>(
    _ path: String, args: Args, token: String?
  ) async throws -> Value {
    var request = URLRequest(url: endpoint)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
    request.httpBody = try JSONEncoder().encode(Body(path: path, args: args, format: "json"))

    let (data, response) = try await session.data(for: request)
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    let outcome = try? JSONDecoder().decode(Outcome.self, from: data)
    guard status == 200, outcome?.status == "success" else {
      throw DomaConvexHTTPError(status: status, message: outcome?.errorMessage)
    }
    do {
      return try JSONDecoder().decode(Success<Value>.self, from: data).value
    } catch {
      // A decoding error can quote the response, so it is replaced.
      throw DomaConvexHTTPError.failed(status: status)
    }
  }

  private struct Body<Args: Encodable>: Encodable {
    let path: String
    let args: Args
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

public enum DomaConvexHTTPError: Error, Equatable {
  /// Convex refused the token (401 or 403), or the function found no signed-in user.
  case unauthenticated
  /// A 400: Convex could not verify the token, or the request was malformed or names a function the
  /// deployment lacks. Not a definite refusal.
  case badRequest
  case failed(status: Int)

  /// A function that finds no identity answers with a 200 error naming it (`requireUserId` in
  /// `lists/items.ts`).
  public init(status: Int, message: String?) {
    if [401, 403].contains(status) || message?.contains("Not authenticated") == true {
      self = .unauthenticated
    } else if status == 400 {
      self = .badRequest
    } else {
      self = .failed(status: status)
    }
  }
}
