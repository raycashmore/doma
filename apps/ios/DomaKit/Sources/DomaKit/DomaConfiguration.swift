import ClerkKit
import Foundation

/// Public client values injected from the ignored xcconfig files through Info.plist.
/// The app and the widget extension read the same keys.
public struct DomaConfiguration: Sendable {
  public let convexURL: String
  public let clerkPublishableKey: String
  /// The keychain access group the app and the widget share the Clerk session through.
  public let keychainAccessGroup: String?

  public static func fromBundle(_ bundle: Bundle = .main) -> DomaConfiguration? {
    guard
      let convexURL = bundle.object(forInfoDictionaryKey: "DomaConvexURL") as? String,
      let key = bundle.object(forInfoDictionaryKey: "DomaClerkPublishableKey") as? String,
      convexURL.hasPrefix("http"), key.hasPrefix("pk_")
    else { return nil }
    let group = (bundle.object(forInfoDictionaryKey: "DomaKeychainAccessGroup") as? String)
      .flatMap { $0.isEmpty ? nil : $0 }
    return DomaConfiguration(convexURL: convexURL, clerkPublishableKey: key, keychainAccessGroup: group)
  }

  /// One service name for both bundles, so the app and the widget find the same session.
  public var clerkKeychain: Clerk.Options.KeychainConfig {
    .init(service: "com.doma.app", accessGroup: keychainAccessGroup)
  }
}
