import Foundation

/// Public client values injected from the ignored xcconfig files through Info.plist.
struct DomaConfiguration {
  let convexURL: String
  let clerkPublishableKey: String

  static func fromBundle(_ bundle: Bundle = .main) -> DomaConfiguration? {
    guard
      let convexURL = bundle.object(forInfoDictionaryKey: "DomaConvexURL") as? String,
      let key = bundle.object(forInfoDictionaryKey: "DomaClerkPublishableKey") as? String,
      convexURL.hasPrefix("http"), key.hasPrefix("pk_")
    else { return nil }
    return DomaConfiguration(convexURL: convexURL, clerkPublishableKey: key)
  }
}
