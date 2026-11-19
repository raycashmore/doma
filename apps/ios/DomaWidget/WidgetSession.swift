import DomaKit
import Foundation
import OSLog

/// Runs Convex queries in the widget process with the device login the app stores in the keychain
/// access group the two bundles share (`Config/Doma.entitlements`).
@MainActor
enum WidgetSession {
  enum Failure: Error {
    /// No device login, or the server refused it. The widget must not show list data.
    case signedOut
    /// Anything that may pass: no connection, a locked keychain, a server error.
    case unreachable
  }

  private static let logger = Logger(subsystem: "com.doma.app", category: "widget")
  private static var connection: (query: DomaConvexHTTPFunction, deviceLogin: DomaDeviceLogin)?

  static func run<Value: Decodable & SendableMetatype, Args: Encodable>(
    _ path: String, args: Args = [String: String]()
  ) async throws(Failure) -> Value {
    guard let (query, deviceLogin) = connect() else {
      logger.error("Widget is not configured")
      throw .unreachable
    }
    do {
      return try await query.run(path, args: args, token: try await token(deviceLogin, forceRefresh: false))
    } catch DomaConvexHTTPError.unauthenticated, DomaConvexHTTPError.badRequest {
      // A refused token is not a sign-out: only the device login's own rejection is. Swap once more.
      logger.info("Convex refused the widget's token; swapping for a new one")
    } catch let failure as Failure {
      throw failure
    } catch {
      logger.error("\(path, privacy: .public) failed: \(String(describing: error), privacy: .public)")
      throw .unreachable
    }
    do {
      return try await query.run(path, args: args, token: try await token(deviceLogin, forceRefresh: true))
    } catch let failure as Failure {
      throw failure
    } catch {
      logger.error("\(path, privacy: .public) failed after a new token: \(String(describing: error), privacy: .public)")
      throw .unreachable
    }
  }

  private static func connect() -> (query: DomaConvexHTTPFunction, deviceLogin: DomaDeviceLogin)? {
    if let connection { return connection }
    guard
      let configuration = DomaConfiguration.fromBundle(),
      let query = DomaConvexHTTPFunction(deploymentURL: configuration.convexURL, kind: .query),
      let transport = DomaDeviceLogin.Transport.convex(deploymentURL: configuration.convexURL)
    else { return nil }
    let deviceLogin = DomaDeviceLogin(keychain: configuration.deviceKeychain, transport: transport)
    connection = (query, deviceLogin)
    return connection
  }

  private static func token(_ deviceLogin: DomaDeviceLogin, forceRefresh: Bool) async throws(Failure) -> String {
    do {
      return try await deviceLogin.token(forceRefresh: forceRefresh)
    } catch .unreachable {
      logger.info("Device token swap failed")
      throw .unreachable
    } catch {
      logger.info("Widget has no device login")
      throw .signedOut
    }
  }
}
