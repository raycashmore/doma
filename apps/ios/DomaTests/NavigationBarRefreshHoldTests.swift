import Testing

@testable import Doma

@MainActor
struct NavigationBarRefreshHoldTests {
  @Test func aRefreshRunsStraightAwayWithNoHold() {
    let hold = NavigationBarRefreshHold()

    #expect(hold.requestRefresh())
    #expect(!hold.isRefreshPending)
  }

  @Test func aHeldRefreshWaitsThenRunsOnceTheHoldClears() {
    let hold = NavigationBarRefreshHold()
    hold.isHeld = true

    #expect(!hold.requestRefresh())
    #expect(hold.isRefreshPending)

    hold.isHeld = false

    #expect(hold.requestRefresh())
    #expect(!hold.isRefreshPending)
  }
}
