import Combine
import ConvexMobile
import OSLog

private let logger = Logger(subsystem: "com.doma.app", category: "subscriptions")

/// Follows a live query until the task ends. A ConvexMobile subscription ends for good on its
/// first error, so this logs the failure and subscribes again, backing off up to a minute.
/// `onFailure` runs only while no value has arrived: after that, the last value stays on screen.
@MainActor
func followLiveQuery<Value>(
  _ name: StaticString,
  subscribe: () -> AnyPublisher<Value, ClientError>,
  onFailure: () -> Void,
  onValue: (Value) -> Void
) async {
  var hasValue = false
  var delay = Duration.seconds(2)
  while !Task.isCancelled {
    do {
      for try await value in subscribe().values {
        hasValue = true
        delay = .seconds(2)
        onValue(value)
      }
      return
    } catch {
      logger.error("\(name, privacy: .public) subscription failed: \(String(describing: error), privacy: .public)")
      if !hasValue { onFailure() }
      try? await Task.sleep(for: delay)
      delay = min(delay * 2, .seconds(60))
    }
  }
}
