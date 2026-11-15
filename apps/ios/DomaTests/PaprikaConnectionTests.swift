import DomaKit
import Foundation
import Testing

@testable import Doma

@MainActor
struct PaprikaConnectionTests {
  private func connection(_ json: String) throws -> DomaPaprikaConnection {
    try JSONDecoder().decode(DomaPaprikaConnection.self, from: Data(json.utf8))
  }

  private func result(_ json: String) throws -> DomaPaprikaCallResult {
    try JSONDecoder().decode(DomaPaprikaCallResult.self, from: Data(json.utf8))
  }

  @Test func decodesTheConnectionTheServerSends() throws {
    let decoded = try connection(
      #"{"status":"connected","groceryLists":[{"uid":"P1","name":"My Grocery List"}],"sourceListUid":"P1","targetList":{"publicId":"list_1","name":"Shopping list"}}"#
    )
    #expect(decoded.status == .connected)
    #expect(decoded.groceryLists.map(\.name) == ["My Grocery List"])
    #expect(decoded.targetList?.publicId == "list_1")

    let unset = try connection(#"{"status":"needs_reconnect","groceryLists":[],"sourceListUid":null,"targetList":null}"#)
    #expect(unset.status == .needsReconnect)
    #expect(unset.targetList == nil)
  }

  @Test func decodesEveryCallOutcomeAndTreatsAnUnknownOneAsUnavailable() throws {
    #expect(try result(#"{"status":"connected"}"#) == .connected)
    #expect(try result(#"{"status":"rejected"}"#) == .rejected)
    #expect(try result(#"{"status":"not_connected"}"#) == .notConnected)
    #expect(try result(#"{"status":"something_new"}"#) == .unavailable)
  }

  @Test func showsSignInUntilConnectedAndAgainWhenPaprikaRefusesTheSignIn() throws {
    #expect(PaprikaConnectionCopy.screen(for: .none) == .loading)
    #expect(PaprikaConnectionCopy.screen(for: .some(nil)) == .signIn(isReconnect: false))

    let refused = try connection(#"{"status":"needs_reconnect","groceryLists":[],"sourceListUid":null,"targetList":null}"#)
    #expect(PaprikaConnectionCopy.screen(for: .some(refused)) == .signIn(isReconnect: true))

    let connected = try connection(#"{"status":"connected","groceryLists":[],"sourceListUid":null,"targetList":null}"#)
    #expect(PaprikaConnectionCopy.screen(for: .some(connected)) == .connected(connected))
  }

  @Test func tellsAWrongPasswordApartFromPaprikaBeingUnreachable() {
    #expect(PaprikaConnectionCopy.connectProblem(.connected) == nil)
    #expect(PaprikaConnectionCopy.connectProblem(.rejected)?.contains("email and password") == true)
    #expect(PaprikaConnectionCopy.connectProblem(.unavailable)?.contains("Couldn't reach") == true)
    #expect(PaprikaConnectionCopy.checkProblem(.rejected) == nil)
    #expect(PaprikaConnectionCopy.checkProblem(.connected) == nil)
  }
}
