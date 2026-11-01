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
    } catch {
      try? await fixture.delete(on: convex)
      throw error
    }
    try await fixture.delete(on: convex)
    await convex.logout()
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
