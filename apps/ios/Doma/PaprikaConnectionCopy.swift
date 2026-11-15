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
    case .rejected: "Paprika didn't accept that email and password."
    case .unavailable, .notConnected: unreachable
    }
  }

  /// The alert for a failed Check Connection, or `nil` when it worked.
  static func checkProblem(_ result: DomaPaprikaCallResult) -> String? {
    switch result {
    // The sheet swaps to the reconnect form, which says why.
    case .connected, .rejected: nil
    case .unavailable: unreachable
    case .notConnected: "Paprika isn't connected."
    }
  }

  private static let unreachable = "Couldn't reach Paprika. Check your connection and try again."
}
