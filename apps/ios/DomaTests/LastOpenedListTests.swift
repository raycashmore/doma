import Foundation
import Testing

@testable import Doma

@MainActor
struct LastOpenedListTests {
  private let store = LastOpenedList(defaults: UserDefaults(suiteName: UUID().uuidString)!)

  @Test func restoresTheRememberedListWhileItIsStillVisible() {
    store.remember("list-a")

    #expect(store.restorableId(among: ["list-a", "list-b"]) == "list-a")
  }

  @Test func doesNotRestoreAListThatIsNoLongerVisible() {
    store.remember("list-a")

    #expect(store.restorableId(among: ["list-b"]) == nil)
  }

  @Test func restoresNothingAfterForgetting() {
    store.remember("list-a")
    store.forget()

    #expect(store.restorableId(among: ["list-a"]) == nil)
  }
}
