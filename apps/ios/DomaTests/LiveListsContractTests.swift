import ClerkKit
@preconcurrency import Combine
@preconcurrency import ConvexMobile
import Foundation
import Testing

import DomaKit

/// Calls a real non-production Convex deployment so Swift/Convex contract drift fails loudly.
/// Run through `apps/ios/scripts/test-live.sh`, which supplies a development-only sign-in ticket.
@Suite(.enabled(if: LiveEnvironment.current != nil, "Live Convex/Clerk environment not supplied"))
@MainActor
struct LiveListsContractTests {
  @Test func signedInAccountReadsAndChecksOffItemsLive() async throws {
    let environment = try #require(LiveEnvironment.current)
    try await signIn(with: environment)

    let convex = ConvexClientWithAuth(deploymentUrl: environment.convexURL, authProvider: DomaClerkConvexAuthProvider())
    let login = await convex.loginFromCache()
    _ = try login.get()

    let fixture = try await ListFixture.create(on: convex)
    do {
      let lists = DomaListsClient(convex: convex)

      // Subscribe before mutating: ConvexMobile drops updates sent before a subscriber attaches.
      let snapshots = LiveValues(lists.widgetSnapshot(listPublicId: fixture.publicId))
      let visibleLists = LiveValues(lists.visibleLists())
      let items = LiveValues(lists.items(listPublicId: fixture.publicId))

      let snapshot = try #require(try await snapshots.next("widget snapshot") { $0 != nil })
      #expect(snapshot.list.name == ListFixture.name)
      #expect(snapshot.activeItems.map(\.title) == ListFixture.itemTitles)

      let visible = try await visibleLists.next("visible lists") { lists in
        lists.contains { $0.publicId == fixture.publicId }
      }
      #expect(visible.first { $0.publicId == fixture.publicId }?.visibility == .personal)

      let initial = try #require(try await items.next("list items") { $0 != nil })
      #expect(initial.activeItems.map(\.title) == ListFixture.itemTitles)
      let first = try #require(initial.activeItems.first)

      try await lists.complete(itemId: first.id)
      let afterComplete = try #require(
        try await items.next("completed item") { $0?.completedItems.contains(first) == true })
      #expect(afterComplete.activeItems.map(\.title) == Array(ListFixture.itemTitles.dropFirst()))
      #expect(afterComplete.completedItems == [first])

      try await lists.uncomplete(itemId: first.id)
      let afterUncomplete = try #require(
        try await items.next("uncompleted item") { $0?.completedItems.isEmpty == true })
      // The server re-appends a restored item after the other active items.
      #expect(afterUncomplete.activeItems.map(\.title) == ListFixture.itemTitles.reversed())

      let propertyIds = try await editItemDetails(on: convex, lists: lists, items: items, listPublicId: fixture.publicId)
      try await groupAndAddSeveral(on: lists, items: items, listPublicId: fixture.publicId, propertyId: propertyIds[3])
      try await manageItems(on: lists, items: items, listPublicId: fixture.publicId)
      try await manageLists(on: lists, visibleLists: visibleLists, fixturePublicId: fixture.publicId)
    } catch {
      try? await fixture.delete(on: convex)
      throw error
    }
    try await fixture.delete(on: convex)
    await convex.logout()
  }

  /// Returns the fixture's property IDs, in property order.
  private func editItemDetails(
    on convex: ConvexClient, lists: DomaListsClient, items: LiveValues<DomaListItems?>, listPublicId: String
  ) async throws -> [String] {
    let propertyIds = try await ListFixture.addProperties(on: convex, listPublicId: listPublicId)
    let loaded = try #require(
      try await items.next("list properties") { $0?.properties.count == propertyIds.count })
    #expect(loaded.properties.map(\.kind) == [.text, .number, .date, .select, .checkbox])
    #expect(loaded.properties[3].options?.map(\.label) == ["High", "Low"])
    let item = try #require(loaded.activeItems.first)

    try await lists.renameItem(itemId: item.id, title: "Renamed fixture item")
    _ = try await items.next("renamed item") { $0?.activeItems.first?.title == "Renamed fixture item" }
    try await lists.renameItem(itemId: item.id, title: item.title)
    _ = try await items.next("restored title") { $0?.activeItems.first?.title == item.title }

    try await lists.setItemNotes(itemId: item.id, notes: "Fixture notes")
    _ = try await items.next("item notes") { $0?.activeItems.first?.notes == "Fixture notes" }
    try await lists.setItemNotes(itemId: item.id, notes: "")
    _ = try await items.next("cleared notes") { $0?.activeItems.first?.notes == nil }

    let date = Date(timeIntervalSince1970: 1_790_000_000)
    let values: [DomaListPropertyValue] = [
      .text("Line one\nLine two"), .number(2.5), .date(date), .select(optionId: "high"), .checkbox(false),
    ]
    for (propertyId, value) in zip(propertyIds, values) {
      try await lists.setItemPropertyValue(itemId: item.id, propertyId: propertyId, value: value)
    }
    let saved = try #require(
      try await items.next("property values") { $0?.activeItems.first?.propertyValues.count == values.count })
    let stored = try #require(saved.activeItems.first?.propertyValues)
    #expect(stored.map(\.propertyId) == propertyIds)
    #expect(stored[0].textValue == "Line one\nLine two")
    #expect(stored[1].numberValue == 2.5)
    #expect(stored[2].dateValue == date.timeIntervalSince1970 * 1000)
    #expect(stored[3].selectOptionId == "high")
    #expect(stored[4].checkboxValue == false)

    for propertyId in propertyIds {
      try await lists.clearItemPropertyValue(itemId: item.id, propertyId: propertyId)
    }
    _ = try await items.next("cleared values") { $0?.activeItems.first?.propertyValues.isEmpty == true }
    return propertyIds
  }

  private func groupAndAddSeveral(
    on lists: DomaListsClient, items: LiveValues<DomaListItems?>, listPublicId: String, propertyId: String
  ) async throws {
    let grouping = LiveValues(lists.groupingPropertyId(listPublicId: listPublicId))
    _ = try await grouping.next("manual order") { $0 == nil }
    try await lists.setGroupingProperty(listPublicId: listPublicId, propertyId: propertyId)
    _ = try await grouping.next("saved grouping") { $0 == propertyId }
    try await lists.setGroupingProperty(listPublicId: listPublicId, propertyId: nil)
    _ = try await grouping.next("manual order again") { $0 == nil }

    let pasted = ["Fixture pasted A", "Fixture pasted B"]
    try await lists.createItems(listPublicId: listPublicId, titles: pasted)
    let afterPaste = try #require(
      try await items.next("pasted items") { $0?.activeItems.suffix(2).map(\.title) == pasted })
    for item in afterPaste.activeItems.suffix(2) {
      try await lists.deleteItem(itemId: item.id)
    }
    _ = try await items.next("removed pasted items") { $0?.activeItems.count == afterPaste.activeItems.count - 2 }
  }

  private func manageItems(
    on lists: DomaListsClient, items: LiveValues<DomaListItems?>, listPublicId: String
  ) async throws {
    let added = "Fixture item C"
    try await lists.createItems(listPublicId: listPublicId, titles: [added])
    let afterAdd = try #require(
      try await items.next("added item") { $0?.activeItems.last?.title == added })
    let newItem = try #require(afterAdd.activeItems.last)

    try await lists.reorderItem(itemId: newItem.id, targetIndex: 0)
    _ = try await items.next("reordered item") { $0?.activeItems.first == newItem }

    try await lists.deleteItem(itemId: newItem.id)
    let afterDelete = try #require(
      try await items.next("deleted item") { $0?.activeItems.contains(newItem) == false })

    let toClear = try #require(afterDelete.activeItems.first)
    try await lists.complete(itemId: toClear.id)
    _ = try await items.next("item to clear") { $0?.completedItems == [toClear] }
    try await lists.clearCompletedItems(listPublicId: listPublicId)
    _ = try await items.next("cleared items") { $0?.completedItems.isEmpty == true }
  }

  private func manageLists(
    on lists: DomaListsClient, visibleLists: LiveValues<[DomaListSummary]>, fixturePublicId: String
  ) async throws {
    let renamed = "iOS tracer fixture renamed"
    try await lists.renameList(publicId: fixturePublicId, name: renamed)
    _ = try await visibleLists.next("renamed list") { lists in
      lists.contains { $0.publicId == fixturePublicId && $0.name == renamed }
    }

    // Moves only the fixture, so the account's other lists keep their order once it is deleted.
    try await lists.reorderList(publicId: fixturePublicId, targetIndex: 0)
    _ = try await visibleLists.next("reordered list") { lists in
      lists.first { $0.visibility == .personal }?.publicId == fixturePublicId
    }

    let created = try await lists.createList(name: "iOS tracer shared fixture", visibility: .shared)
    let afterCreate = try await visibleLists.next("created list") { lists in
      lists.contains { $0.publicId == created }
    }
    #expect(afterCreate.first { $0.publicId == created }?.visibility == .shared)
    try await lists.deleteList(publicId: created)
    _ = try await visibleLists.next("deleted list") { lists in
      !lists.contains { $0.publicId == created }
    }

    let defaults = LiveValues(lists.defaultList())
    let previousDefault = try await defaults.next("current default") { _ in true }
    try await lists.setDefaultList(publicId: fixturePublicId)
    _ = try await defaults.next("new default") { $0?.publicId == fixturePublicId }
    if let previousDefault {
      try await lists.setDefaultList(publicId: previousDefault.publicId)
    }
  }

  private func signIn(with environment: LiveEnvironment) async throws {
    Clerk.configure(publishableKey: environment.clerkPublishableKey)
    try await waitUntil("Clerk loaded") { Clerk.shared.isLoaded }
    if Clerk.shared.session != nil { try await Clerk.shared.auth.signOut() }
    try await Clerk.shared.auth.signInWithTicket(environment.signInTicket)
    try await waitUntil("active Clerk session") { Clerk.shared.session?.status == .active }
  }
}

struct LiveEnvironment {
  let convexURL: String
  let clerkPublishableKey: String
  let signInTicket: String

  static var current: LiveEnvironment? {
    let env = ProcessInfo.processInfo.environment
    guard
      let convexURL = env["DOMA_CONVEX_URL"], !convexURL.isEmpty,
      let key = env["DOMA_CLERK_PUBLISHABLE_KEY"], key.hasPrefix("pk_test_"),
      let ticket = env["DOMA_TEST_SIGN_IN_TICKET"], !ticket.isEmpty
    else { return nil }
    return LiveEnvironment(convexURL: convexURL, clerkPublishableKey: key, signInTicket: ticket)
  }
}

/// A personal list owned by the test account, so no household data is read or changed.
struct ListFixture {
  static let name = "iOS tracer fixture"
  static let itemTitles = ["Fixture item A", "Fixture item B"]

  let publicId: String

  private struct Created: Decodable { let publicId: String }
  private struct Ignored: Decodable { init(from decoder: any Decoder) throws {} }

  static func create(on convex: ConvexClient) async throws -> ListFixture {
    let created: Created = try await convex.mutation(
      "lists/mutations:createList", with: ["name": name, "visibility": "personal"])
    for title in itemTitles {
      let _: Ignored = try await convex.mutation(
        "lists/mutations:createListItem", with: ["listPublicId": created.publicId, "title": title])
    }
    return ListFixture(publicId: created.publicId)
  }

  /// Definitions are managed on the web, so the client has no wrapper for creating them.
  static func addProperties(on convex: ConvexClient, listPublicId: String) async throws -> [String] {
    let options: [ConvexEncodable?] = [
      ["id": "high", "label": "High"] as [String: ConvexEncodable?],
      ["id": "low", "label": "Low"] as [String: ConvexEncodable?],
    ]
    var ids: [String] = []
    for type in ["text", "number", "date", "select", "checkbox"] {
      var args: [String: ConvexEncodable?] = ["listPublicId": listPublicId, "name": "Fixture \(type)", "type": type]
      if type == "select" { args["options"] = options }
      let created: CreatedProperty = try await convex.mutation("lists/mutations:createListProperty", with: args)
      ids.append(created.id)
    }
    return ids
  }

  private struct CreatedProperty: Decodable {
    let id: String

    enum CodingKeys: String, CodingKey {
      case id = "_id"
    }
  }

  func delete(on convex: ConvexClient) async throws {
    let _: Ignored = try await convex.mutation("lists/mutations:deleteList", with: ["publicId": publicId])
  }
}

struct TimedOut: Error, CustomStringConvertible {
  let description: String
}

@MainActor
func waitUntil(_ label: String, timeout: Duration = .seconds(20), _ condition: () -> Bool) async throws {
  let deadline = ContinuousClock.now + timeout
  while !condition() {
    guard ContinuousClock.now < deadline else { throw TimedOut(description: "Timed out waiting for \(label)") }
    try await Task.sleep(for: .milliseconds(100))
  }
}

/// Collects every value a Convex subscription publishes so steps can await them in order.
@MainActor
final class LiveValues<Value> {
  private var received: [Value] = []
  private var consumed = 0
  private var failure: ClientError?
  private var subscription: AnyCancellable?

  init(_ publisher: AnyPublisher<Value, ClientError>) {
    subscription = publisher
      .receive(on: DispatchQueue.main)
      .sink { [weak self] completion in
        if case .failure(let error) = completion { self?.failure = error }
      } receiveValue: { [weak self] value in
        self?.received.append(value)
      }
  }

  /// Returns the next unconsumed value matching `predicate`, skipping earlier ones.
  func next(_ label: String, where predicate: (Value) -> Bool) async throws -> Value {
    var match: Int?
    try await waitUntil(label) {
      match = received.indices.dropFirst(consumed).first { predicate(received[$0]) }
      return match != nil || failure != nil
    }
    guard let index = match else { throw failure ?? TimedOut(description: label) }
    consumed = index + 1
    return received[index]
  }
}
