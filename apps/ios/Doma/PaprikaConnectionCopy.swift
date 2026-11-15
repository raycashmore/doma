import DomaKit

/// What the Paprika sheet shows for a connection and for each call's outcome.
enum PaprikaConnectionCopy {
  enum Screen: Equatable {
    case loading
    case signIn(isReconnect: Bool)
    case connected(DomaPaprikaConnection)
  }

  /// `connection` is `nil` while loading and `.some(nil)` once the server says there is none.
  static func screen(for connection: DomaPaprikaConnection??) -> Screen {
    switch connection {
    case .none: .loading
    case .some(.none): .signIn(isReconnect: false)
    case .some(.some(let connection)) where connection.status == .needsReconnect: .signIn(isReconnect: true)
    case .some(.some(let connection)): .connected(connection)
    }
  }

  static let reconnectNotice = "Paprika stopped accepting Doma's sign-in. Sign in again to reconnect. Your lists are unaffected."
  static let tokenFootnote = "Doma keeps a sign-in token from Paprika, not your password."

  /// The alert for a failed Connect, or `nil` when it worked.
  static func connectProblem(_ result: DomaPaprikaCallResult) -> String? {
    switch result {
    case .connected: nil
    case .rejected(let reason): "Paprika didn't accept that email and password." + paprikaSaid(reason)
    case .unavailable(let httpStatus): unreachable(httpStatus)
    case .notConnected: unreachable(nil)
    }
  }

  /// The alert for a failed Check Connection, or `nil` when it worked.
  static func checkProblem(_ result: DomaPaprikaCallResult) -> String? {
    switch result {
    // The sheet swaps to the reconnect form, which says why.
    case .connected, .rejected: nil
    case .unavailable(let httpStatus): unreachable(httpStatus)
    case .notConnected: "Paprika isn't connected."
    }
  }

  private static func paprikaSaid(_ reason: String?) -> String {
    reason.map { " Paprika said: \"\($0)\"" } ?? ""
  }

  /// A 401 or 403 that isn't Paprika's own reply means something in front of Paprika turned Doma away.
  private static func unreachable(_ httpStatus: Int?) -> String {
    switch httpStatus {
    case 401?, 403?: "Paprika turned away Doma's server (HTTP \(httpStatus ?? 0)). Your email and password weren't checked."
    case let status?: "Couldn't reach Paprika (HTTP \(status)). Try again in a moment."
    case nil: "Couldn't reach Paprika. Check your connection and try again."
    }
  }
}
