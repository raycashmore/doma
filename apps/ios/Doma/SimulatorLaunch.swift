#if DEBUG && targetEnvironment(simulator)
import Foundation

/// Lets agents and scripts reach signed-in screens headlessly. Compiled out of device and release builds.
enum SimulatorLaunch {
  private static let skipAppLockKey = "DOMA_SKIP_APP_LOCK"
  private static let signInTicketPath = "/tmp/doma-ios-sign-in-ticket"

  /// `simctl` passes environment variables and `agent-device` passes launch arguments.
  static var skipsAppLock: Bool {
    let process = ProcessInfo.processInfo
    return process.environment[skipAppLockKey] == "1" || process.arguments.contains("\(skipAppLockKey)=1")
  }

  /// The ticket written by `scripts/simulator-sign-in.sh`, removed on read because Clerk accepts it once.
  static func consumeSignInTicket() -> String? {
    guard let ticket = try? String(contentsOfFile: signInTicketPath, encoding: .utf8) else { return nil }
    try? FileManager.default.removeItem(atPath: signInTicketPath)
    return ticket.trimmingCharacters(in: .whitespacesAndNewlines)
  }
}
#endif
