import Observation

/// A dragged order kept on screen until the live subscription confirms it, so rows do not flick
/// back when a save returns before its update arrives. Each save waits for the one before, so
/// quick drags land in order.
@MainActor @Observable
final class HeldOrder {
  /// The order on screen while it waits for confirmation.
  private(set) var ids: [String]?
  /// How long a hold may wait for confirmation once every save has returned.
  @ObservationIgnored private let releaseDelay: Duration
  @ObservationIgnored private var lastSave: Task<Void, Never>?
  @ObservationIgnored private var releaseTimer: Task<Void, Never>?
  @ObservationIgnored private var savesInFlight = 0
  /// Updates that arrived, all saves done, without the held order.
  @ObservationIgnored private var unconfirmedUpdates = 0

  init(releaseDelay: Duration = .seconds(2)) {
    self.releaseDelay = releaseDelay
  }

  /// The server's rows in the held order. Rows the hold does not know go last.
  func ordered<Element: Identifiable>(_ server: [Element]) -> [Element] where Element.ID == String {
    guard let ids else { return server }
    let byId = Dictionary(server.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    let known = Set(ids)
    return ids.compactMap { byId[$0] } + server.filter { !known.contains($0.id) }
  }

  /// Shows `ids` at once, then runs `save` after any earlier save. A failure puts the server's order
  /// back, because any later drag was worked out from the order that failed, and calls `onFailure`.
  func hold(_ ids: [String], save: @escaping () async throws -> Void, onFailure: @escaping () -> Void) {
    self.ids = ids
    unconfirmedUpdates = 0
    releaseTimer?.cancel()
    savesInFlight += 1
    let previous = lastSave
    lastSave = Task {
      await previous?.value
      do {
        try await save()
      } catch {
        self.ids = nil
        onFailure()
      }
      savesInFlight -= 1
      if savesInFlight == 0 { startReleaseTimer() }
    }
  }

  /// Call with each live value's ids.
  func serverChanged(to serverIds: [String]) {
    guard let ids else { return }
    if serverIds == ids {
      release()
      return
    }
    guard savesInFlight == 0 else { return }
    unconfirmedUpdates += 1
    // An update can still be older than the save, so one mismatch is not enough. A second one, or
    // rows added or removed by someone else, means the server has moved on.
    if Set(serverIds) != Set(ids) || unconfirmedUpdates >= 2 { release() }
  }

  /// The confirming update may have arrived before the last save returned, so none may follow.
  private func startReleaseTimer() {
    guard ids != nil else { return }
    releaseTimer = Task { [releaseDelay] in
      try? await Task.sleep(for: releaseDelay)
      if !Task.isCancelled { release() }
    }
  }

  private func release() {
    ids = nil
    releaseTimer?.cancel()
    releaseTimer = nil
  }
}
