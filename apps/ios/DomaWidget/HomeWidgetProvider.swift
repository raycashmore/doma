import DomaKit
import Foundation
import OSLog
import WidgetKit

struct HomeWidgetEntry: TimelineEntry, Sendable {
  enum Content: Sendable {
    case board(DomaHomeWidgetBoard)
    case signedOut
    case failed
  }

  let date: Date
  let content: Content
}

/// One fetch makes a timeline with an entry at each event's start and end and at each midnight,
/// so finished events leave and "Wed" becomes today without another fetch. The app asks for a
/// redraw when it leaves the foreground; otherwise this asks for a fetch every 15 minutes.
struct HomeWidgetProvider: TimelineProvider {
  static let kind = "DomaHomeWidget"

  private static let logger = Logger(subsystem: "com.doma.app", category: "widget")
  private static let refreshInterval: TimeInterval = 15 * 60
  /// Covers a day of missed fetches; iOS limits how many entries it keeps.
  private static let timelineSpan: TimeInterval = 24 * 60 * 60
  private static let cacheKey = "homeWidgetSummary"

  func placeholder(in context: Context) -> HomeWidgetEntry {
    HomeWidgetEntry(date: .now, content: .board(DomaHomeWidgetBoard(summary: .sample(now: .now), at: .now)))
  }

  func getSnapshot(in context: Context, completion: @escaping @Sendable (HomeWidgetEntry) -> Void) {
    if context.isPreview { return completion(placeholder(in: context)) }
    Task { completion(Self.entries(from: await Self.load(), now: .now).first!) }
  }

  func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<HomeWidgetEntry>) -> Void) {
    Task {
      let now = Date.now
      let entries = Self.entries(from: await Self.load(), now: now)
      Self.logger.info("Home timeline refreshed with \(entries.count, privacy: .public) entries")
      completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(Self.refreshInterval))))
    }
  }

  private static func entries(from content: Result<DomaHomeWidgetSummary, WidgetSession.Failure>, now: Date) -> [HomeWidgetEntry] {
    switch content {
    case .success(let summary):
      let dates = DomaHomeWidgetBoard.changeDates(
        for: summary, after: now, until: now.addingTimeInterval(timelineSpan), calendar: .current)
      return ([now] + dates).map { HomeWidgetEntry(date: $0, content: .board(DomaHomeWidgetBoard(summary: summary, at: $0))) }
    case .failure(.signedOut):
      return [HomeWidgetEntry(date: now, content: .signedOut)]
    case .failure(.unreachable):
      return [HomeWidgetEntry(date: now, content: .failed)]
    }
  }

  /// A rejected sign-in forgets the last summary. Only a network failure falls back on it; its
  /// events still leave as they finish.
  @MainActor
  private static func load() async -> Result<DomaHomeWidgetSummary, WidgetSession.Failure> {
    let defaults = UserDefaults.standard
    do throws(WidgetSession.Failure) {
      // The query reads the clock, so a token from the current minute avoids a cached older result.
      let token = (Date.now.timeIntervalSince1970 / 60).rounded(.down)
      let summary: DomaHomeWidgetSummary = try await WidgetSession.run(
        "home/widgetSummary:homeWidgetSummary", args: ["refreshToken": token])
      defaults.set(try? JSONEncoder().encode(summary), forKey: cacheKey)
      return .success(summary)
    } catch .signedOut {
      defaults.removeObject(forKey: cacheKey)
      return .failure(.signedOut)
    } catch {
      let cached = defaults.data(forKey: cacheKey).flatMap { try? JSONDecoder().decode(DomaHomeWidgetSummary.self, from: $0) }
      return cached.map { .success($0) } ?? .failure(.unreachable)
    }
  }
}

extension DomaHomeWidgetSummary {
  /// The widget gallery's preview: placeholder names only.
  static func sample(now: Date) -> DomaHomeWidgetSummary {
    let hour: TimeInterval = 60 * 60
    return DomaHomeWidgetSummary(
      next: Event(id: "sample-1", title: "Pick up Sam", detail: "Dancing", start: now + 1.5 * hour, end: now + 2 * hour),
      thisWeek: Week(
        events: [
          Event(id: "sample-2", title: "Bins out", start: now + 3 * hour, end: now + 3.5 * hour),
          Event(id: "sample-3", title: "Swimming", start: now + 26 * hour, end: now + 27 * hour),
        ]),
      list: List(publicId: "sample", name: "Shopping", activeCount: 8),
      note: Note(kind: .manualNote, id: "sample", title: "Plumber Thursday morning")
    )
  }
}
