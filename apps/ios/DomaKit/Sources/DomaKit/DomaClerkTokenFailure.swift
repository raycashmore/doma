import ClerkKit
import Foundation

/// Sorts a failure to get a Convex token from Clerk. A rejected session must clear the widget, so
/// it never shows a list after sign-in ends; anything that may pass keeps the last list.
public enum DomaClerkTokenFailure: Equatable, Sendable {
  case signedOut
  case unreachable

  /// Clerk error codes for a busy or failing Clerk rather than a rejected session.
  private static let transientCodes: Set<String> = ["too_many_requests", "internal_clerk_error", "service_unavailable"]

  public init(_ error: any Error) {
    switch error {
    case is CancellationError:
      self = .unreachable
    case let apiError as ClerkAPIError:
      // Its status is not public, so unknown codes count as a rejection: a stale list is worse
      // than a widget that says it is signed out until the next refresh.
      self = Self.transientCodes.contains(apiError.code) ? .unreachable : .signedOut
    case let urlError as URLError:
      // Clerk tags an error response without a Clerk body with its status.
      let status = urlError.userInfo["ClerkHTTPStatusCode"] as? Int
      self = [401, 403, 404].contains(status ?? 0) ? .signedOut : .unreachable
    default:
      self = Self.isNetworkError(error) ? .unreachable : .signedOut
    }
  }

  private static func isNetworkError(_ error: any Error) -> Bool {
    var current: NSError? = error as NSError
    while let nsError = current {
      if nsError.domain == NSURLErrorDomain { return true }
      current = nsError.userInfo[NSUnderlyingErrorKey] as? NSError
    }
    return false
  }
}
