import DomaKit
import Foundation
import Testing

struct CategorisationResultTests {
  private func decode(_ json: String) throws -> DomaCategorisationResult {
    try JSONDecoder().decode(DomaCategorisationResult.self, from: Data(json.utf8))
  }

  @Test func keepsTheFailureReasonTheAlertDependsOn() throws {
    #expect(try decode(#"{"status":"failed","reason":"provider_out_of_credits"}"#) == .failed(reason: "provider_out_of_credits"))
    #expect(try decode(#"{"status":"failed"}"#) == .failed(reason: "unknown"))
  }
}
