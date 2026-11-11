import ClerkKit
import DomaKit
import Foundation
import Testing

struct DomaWidgetContentTests {
  private let cache = DomaWidgetSnapshotCache(defaults: UserDefaults(suiteName: UUID().uuidString)!)
  private let fetched = Date(timeIntervalSince1970: 1_000)
  private let later = Date(timeIntervalSince1970: 5_000)

  private static func snapshot(_ name: String) -> DomaWidgetSnapshot {
    DomaWidgetSnapshot(
      list: DomaListSummaryReference(publicId: "list-\(name)", name: name, slug: name),
      activeItems: [.init(id: "item-1", title: "Milk")]
    )
  }

  @Test func showsAFreshListWithoutItsAge() {
    let content = DomaWidgetContent.resolve(.loaded(Self.snapshot("A")), cache: cache, key: "a", now: fetched)

    #expect(content == .list(Self.snapshot("A"), fetchedAt: fetched, showsAge: false))
  }

  @Test func keepsTheLastListWithItsAgeWhenTheNetworkFails() {
    _ = DomaWidgetContent.resolve(.loaded(Self.snapshot("A")), cache: cache, key: "a", now: fetched)

    let content = DomaWidgetContent.resolve(.networkFailure, cache: cache, key: "a", now: later)

    #expect(content == .list(Self.snapshot("A"), fetchedAt: fetched, showsAge: true))
  }

  @Test func neverShowsAnOldListOnceSignedOut() {
    _ = DomaWidgetContent.resolve(.loaded(Self.snapshot("A")), cache: cache, key: "a", now: fetched)
    _ = DomaWidgetContent.resolve(.loaded(Self.snapshot("B")), cache: cache, key: "b", now: fetched)

    #expect(DomaWidgetContent.resolve(.signedOut, cache: cache, key: "a", now: later) == .signedOut)
    // A later network failure, for any widget, finds nothing to fall back on.
    #expect(DomaWidgetContent.resolve(.networkFailure, cache: cache, key: "a", now: later) == .failed)
    #expect(DomaWidgetContent.resolve(.networkFailure, cache: cache, key: "b", now: later) == .failed)
  }

  @Test func forgetsAListThatIsNoLongerVisible() {
    _ = DomaWidgetContent.resolve(.loaded(Self.snapshot("A")), cache: cache, key: "a", now: fetched)

    #expect(DomaWidgetContent.resolve(.notVisible, cache: cache, key: "a", now: later) == .unavailable)
    #expect(DomaWidgetContent.resolve(.networkFailure, cache: cache, key: "a", now: later) == .failed)
  }

  @Test func reportsAMissingDefaultList() {
    #expect(DomaWidgetContent.resolve(.noDefaultList, cache: cache, key: "default", now: fetched) == .noList)
  }
}

struct DomaListLinkTests {
  @Test func roundTripsAListId() throws {
    let url = try #require(DomaListLink.url(publicId: "abc123"))

    #expect(url.absoluteString == "com.doma.app://lists/abc123")
    #expect(DomaListLink.publicId(from: url) == "abc123")
  }

  @Test func ignoresOtherLinks() throws {
    #expect(DomaListLink.publicId(from: try #require(URL(string: "com.doma.app://callback?code=1"))) == nil)
    #expect(DomaListLink.publicId(from: try #require(URL(string: "com.doma.app://lists/"))) == nil)
    #expect(DomaListLink.publicId(from: try #require(URL(string: "https://lists/abc"))) == nil)
  }
}

struct DomaConvexHTTPQueryErrorTests {
  @Test func treatsARejectedTokenAsSignedOut() {
    #expect(DomaConvexHTTPQueryError(status: 400, message: nil) == .unauthenticated)
    #expect(DomaConvexHTTPQueryError(status: 401, message: nil) == .unauthenticated)
  }

  @Test func treatsAMissingIdentityAsSignedOut() {
    let message = "[Request ID: 1] Server Error\nUncaught Error: Not authenticated\n    at requireUserId"
    #expect(DomaConvexHTTPQueryError(status: 200, message: message) == .unauthenticated)
  }

  @Test func treatsAServerErrorAsPassing() {
    #expect(DomaConvexHTTPQueryError(status: 503, message: nil) == .failed(status: 503))
    #expect(DomaConvexHTTPQueryError(status: 200, message: "List unavailable") == .failed(status: 200))
  }
}

struct DomaClerkTokenFailureTests {
  private static func apiError(_ code: String) throws -> ClerkAPIError {
    try JSONDecoder().decode(ClerkAPIError.self, from: Data(#"{"code":"\#(code)"}"#.utf8))
  }

  @Test func treatsARejectedSessionAsSignedOut() throws {
    #expect(DomaClerkTokenFailure(try Self.apiError("authentication_invalid")) == .signedOut)
    #expect(DomaClerkTokenFailure(URLError(.unknown, userInfo: ["ClerkHTTPStatusCode": 401])) == .signedOut)
  }

  @Test func keepsTheLastListWhenClerkIsBusyOrUnreachable() throws {
    #expect(DomaClerkTokenFailure(try Self.apiError("too_many_requests")) == .unreachable)
    #expect(DomaClerkTokenFailure(try Self.apiError("internal_clerk_error")) == .unreachable)
    #expect(DomaClerkTokenFailure(URLError(.notConnectedToInternet)) == .unreachable)
    #expect(DomaClerkTokenFailure(URLError(.unknown, userInfo: ["ClerkHTTPStatusCode": 503])) == .unreachable)
    #expect(DomaClerkTokenFailure(CancellationError()) == .unreachable)
  }
}
