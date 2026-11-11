import Foundation

/// What a list widget shows, decided from one refresh attempt and the last list it showed.
///
/// A rejected sign-in never falls back to the last list: the widget says it is signed out and
/// forgets what it showed. Only a network failure keeps the last list, marked with its age.
public enum DomaWidgetContent: Equatable, Sendable {
  /// `showsAge` marks a list that may be out of date: the refresh failed, or none has run for a while.
  case list(DomaWidgetSnapshot, fetchedAt: Date, showsAge: Bool)
  case signedOut
  /// The list was deleted, or the signed-in person can no longer see it.
  case unavailable
  /// No default list is set and the widget has not been given one.
  case noList
  /// The refresh failed and there is no earlier list to show.
  case failed

  public enum Attempt: Sendable {
    case loaded(DomaWidgetSnapshot)
    case notVisible
    case noDefaultList
    case signedOut
    case networkFailure
  }

  public static func resolve(_ attempt: Attempt, cache: DomaWidgetSnapshotCache, key: String, now: Date) -> DomaWidgetContent {
    switch attempt {
    case .loaded(let snapshot):
      cache.store(snapshot, fetchedAt: now, key: key)
      return .list(snapshot, fetchedAt: now, showsAge: false)
    case .signedOut:
      cache.removeAll()
      return .signedOut
    case .notVisible:
      cache.remove(key: key)
      return .unavailable
    case .noDefaultList:
      cache.remove(key: key)
      return .noList
    case .networkFailure:
      guard let cached = cache.entry(key: key) else { return .failed }
      return .list(cached.snapshot, fetchedAt: cached.fetchedAt, showsAge: true)
    }
  }
}

/// The last list each widget configuration showed. It lives in the widget's own defaults.
public struct DomaWidgetSnapshotCache: @unchecked Sendable {
  public struct Entry: Codable, Equatable, Sendable {
    public let snapshot: DomaWidgetSnapshot
    public let fetchedAt: Date
  }

  private static let prefix = "widgetSnapshot."
  private let defaults: UserDefaults

  public init(defaults: UserDefaults = .standard) {
    self.defaults = defaults
  }

  public func entry(key: String) -> Entry? {
    defaults.data(forKey: Self.prefix + key).flatMap { try? JSONDecoder().decode(Entry.self, from: $0) }
  }

  func store(_ snapshot: DomaWidgetSnapshot, fetchedAt: Date, key: String) {
    guard let data = try? JSONEncoder().encode(Entry(snapshot: snapshot, fetchedAt: fetchedAt)) else { return }
    defaults.set(data, forKey: Self.prefix + key)
  }

  func remove(key: String) {
    defaults.removeObject(forKey: Self.prefix + key)
  }

  func removeAll() {
    for key in defaults.dictionaryRepresentation().keys where key.hasPrefix(Self.prefix) {
      defaults.removeObject(forKey: key)
    }
  }
}
