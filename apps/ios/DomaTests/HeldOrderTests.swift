import Testing

@testable import Doma

private struct Row: Identifiable, Equatable {
  let id: String
}

private func rows(_ ids: String...) -> [Row] { ids.map(Row.init) }

/// A save the test finishes by hand, so updates can arrive before or after it returns.
@MainActor
private final class PendingSave {
  private var continuation: CheckedContinuation<Void, any Error>?
  private(set) var started = false

  func run() async throws {
    started = true
    try await withCheckedThrowingContinuation { continuation = $0 }
  }

  func finish(throwing error: (any Error)? = nil) async {
    while continuation == nil { await Task.yield() }
    if let error { continuation?.resume(throwing: error) } else { continuation?.resume() }
    continuation = nil
    for _ in 0..<5 { await Task.yield() }
  }
}

private struct SaveFailed: Error {}

@MainActor
struct HeldOrderTests {
  @Test func keepsTheDraggedOrderAfterTheSaveReturnsUntilTheLiveUpdateShowsIt() async {
    let held = HeldOrder()
    let save = PendingSave()
    held.hold(["b", "a", "c"], save: save.run, onFailure: {})

    await save.finish()
    held.serverChanged(to: ["a", "b", "c"])  // an update from before the save

    #expect(held.ordered(rows("a", "b", "c")).map(\.id) == ["b", "a", "c"])

    held.serverChanged(to: ["b", "a", "c"])
    #expect(held.ids == nil)
  }

  @Test func quickDragsSaveInOrder() async {
    let held = HeldOrder()
    let first = PendingSave()
    let second = PendingSave()
    held.hold(["b", "a", "c"], save: first.run, onFailure: {})
    held.hold(["c", "b", "a"], save: second.run, onFailure: {})
    for _ in 0..<5 { await Task.yield() }

    #expect(first.started)
    #expect(!second.started)

    await first.finish()
    #expect(second.started)
    held.serverChanged(to: ["b", "a", "c"])  // the first save's update
    #expect(held.ids == ["c", "b", "a"])

    await second.finish()
    held.serverChanged(to: ["c", "b", "a"])
    #expect(held.ids == nil)
  }

  @Test func aFailedSavePutsTheSavedOrderBackAndReportsIt() async {
    let held = HeldOrder()
    let save = PendingSave()
    var failed = false
    held.hold(["b", "a"], save: save.run, onFailure: { failed = true })

    await save.finish(throwing: SaveFailed())

    #expect(failed)
    #expect(held.ordered(rows("a", "b")).map(\.id) == ["a", "b"])
  }

  @Test func aFailedSaveDropsALaterDragWorkedOutFromIt() async {
    let held = HeldOrder()
    let first = PendingSave()
    let second = PendingSave()
    held.hold(["b", "a", "c"], save: first.run, onFailure: {})
    held.hold(["c", "b", "a"], save: second.run, onFailure: {})

    await first.finish(throwing: SaveFailed())

    #expect(held.ids == nil)
    await second.finish()
  }

  @Test func letsGoWhenTheOnlyUpdateArrivedBeforeTheSaveReturned() async {
    let releaseWait = PendingSave()
    let held = HeldOrder(waitBeforeRelease: { try? await releaseWait.run() })
    let save = PendingSave()
    held.hold(["b", "a"], save: save.run, onFailure: {})

    held.serverChanged(to: ["a", "b"])  // the server's final order, before the save returns
    await save.finish()
    #expect(held.ids == ["b", "a"])

    await releaseWait.finish()
    #expect(held.ids == nil)
  }

  @Test func letsGoWhenSomeoneElseAddsARow() async {
    let held = HeldOrder()
    let save = PendingSave()
    held.hold(["b", "a"], save: save.run, onFailure: {})
    await save.finish()

    held.serverChanged(to: ["a", "b", "new"])

    #expect(held.ids == nil)
  }

  @Test func letsGoAfterASecondUpdateWithoutTheHeldOrder() async {
    let held = HeldOrder()
    let save = PendingSave()
    held.hold(["b", "a"], save: save.run, onFailure: {})
    await save.finish()

    held.serverChanged(to: ["a", "b"])
    #expect(held.ids == ["b", "a"])
    held.serverChanged(to: ["a", "b"])
    #expect(held.ids == nil)
  }

  @Test func showsRowsTheHoldDoesNotKnowAtTheEnd() {
    let held = HeldOrder()
    held.hold(["b", "a"], save: {}, onFailure: {})

    #expect(held.ordered(rows("a", "b", "new")).map(\.id) == ["b", "a", "new"])
    #expect(held.ordered(rows("a")).map(\.id) == ["a"])
  }
}
