import Foundation

/// The links the Home widget opens: `com.doma.app://home`, or `com.doma.app://home/<board item id>`
/// to open one noticeboard card, such as `manualNote:<id>`.
public enum DomaHomeLink: Equatable, Sendable {
  case board
  case item(String)

  public var url: URL? {
    var components = URLComponents()
    components.scheme = "com.doma.app"
    components.host = "home"
    if case .item(let id) = self { components.path = "/" + id }
    return components.url
  }

  public init?(url: URL) {
    guard url.scheme == "com.doma.app", url.host() == "home" else { return nil }
    let id = url.path(percentEncoded: false).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    if id.isEmpty {
      self = .board
    } else if id.contains("/") {
      return nil
    } else {
      self = .item(id)
    }
  }
}
