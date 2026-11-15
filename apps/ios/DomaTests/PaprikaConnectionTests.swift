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
      #"{"status":"connected","groceryLists":[{"uid":"P1","name":"My Grocery List"}],"sourceListUid":"P1","groceriesList":{"publicId":"list_1","name":"Shopping list"}}"#
    )
    #expect(decoded.status == .connected)
    #expect(decoded.groceryLists.map(\.name) == ["My Grocery List"])
    #expect(decoded.groceriesList?.publicId == "list_1")

    let unset = try connection(#"{"status":"needs_reconnect","groceryLists":[],"sourceListUid":null,"groceriesList":null}"#)
    #expect(unset.status == .needsReconnect)
    #expect(unset.groceriesList == nil)
  }

  @Test func decodesEveryCallOutcomeWithPaprikasReason() throws {
    #expect(try result(#"{"status":"connected"}"#) == .connected)
    #expect(try result(#"{"status":"rejected","reason":"Account not found."}"#) == .rejected(reason: "Account not found."))
    #expect(try result(#"{"status":"unavailable","httpStatus":403}"#) == .unavailable(httpStatus: 403))
    #expect(try result(#"{"status":"not_connected"}"#) == .notConnected)
    #expect(try result(#"{"status":"something_new"}"#) == .unavailable(httpStatus: nil))
  }

  @Test func showsSignInUntilConnectedAndAgainWhenPaprikaRefusesTheSignIn() throws {
    #expect(PaprikaConnectionCopy.screen(for: .none) == .loading)
    #expect(PaprikaConnectionCopy.screen(for: .some(nil)) == .signIn(isReconnect: false))

    let refused = try connection(#"{"status":"needs_reconnect","groceryLists":[],"sourceListUid":null,"groceriesList":null}"#)
    #expect(PaprikaConnectionCopy.screen(for: .some(refused)) == .signIn(isReconnect: true))

    let connected = try connection(#"{"status":"connected","groceryLists":[],"sourceListUid":null,"groceriesList":null}"#)
    #expect(PaprikaConnectionCopy.screen(for: .some(connected)) == .connected(connected))
  }

  @Test func tellsAWrongPasswordApartFromBeingTurnedAway() {
    #expect(PaprikaConnectionCopy.connectProblem(.connected) == nil)
    #expect(
      PaprikaConnectionCopy.connectProblem(.rejected(reason: "Account not found."))
        == "Paprika didn't accept that email and password. Paprika said: \"Account not found.\""
    )
    #expect(PaprikaConnectionCopy.connectProblem(.unavailable(httpStatus: 403))?.contains("turned away") == true)
    #expect(PaprikaConnectionCopy.connectProblem(.unavailable(httpStatus: nil))?.contains("Couldn't reach") == true)
    #expect(PaprikaConnectionCopy.checkProblem(.rejected(reason: nil)) == nil)
    #expect(PaprikaConnectionCopy.checkProblem(.connected) == nil)
  }
}
