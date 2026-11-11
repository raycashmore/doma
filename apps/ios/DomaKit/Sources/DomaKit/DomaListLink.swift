import Foundation

/// The link a widget opens: `com.doma.app://lists/<publicId>`. It shares the scheme Clerk's
/// redirect uses, which reaches the app through its own callback rather than `onOpenURL`.
public enum DomaListLink {
  public static func url(publicId: String) -> URL? {
    var components = URLComponents()
    components.scheme = "com.doma.app"
    components.host = "lists"
    components.path = "/" + publicId
    return components.url
  }

  public static func publicId(from url: URL) -> String? {
    guard url.scheme == "com.doma.app", url.host() == "lists" else { return nil }
    let id = url.path().trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    return id.isEmpty || id.contains("/") ? nil : id
  }
}
