import DomaKit
import Foundation
import OSLog
import WidgetKit

struct ListWidgetEntry: TimelineEntry {
  let date: Date
  let content: DomaWidgetContent
}

/// iOS decides when widgets refresh. The app asks for a redraw when it leaves the foreground (iOS
/// holds requests made while it is open); otherwise this asks for a refresh every 15 minutes, and
/// a list marks its age after 30.
struct ListWidgetProvider: AppIntentTimelineProvider {
  private static let logger = Logger(subsystem: "com.doma.app", category: "widget")
  private static let refreshInterval: TimeInterval = 15 * 60
  private static let showAgeAfter: TimeInterval = 30 * 60

  func placeholder(in context: Context) -> ListWidgetEntry {
    ListWidgetEntry(date: .now, content: .list(.sample, fetchedAt: .now, showsAge: false))
  }

  func snapshot(for configuration: SelectListIntent, in context: Context) async -> ListWidgetEntry {
    if context.isPreview { return placeholder(in: context) }
    return await load(configuration)
  }

  func timeline(for configuration: SelectListIntent, in context: Context) async -> Timeline<ListWidgetEntry> {
    let entry = await load(configuration)
    Self.logger.info("Timeline refreshed: \(entry.content.logName, privacy: .public)")
    var entries = [entry]
    if case .list(let snapshot, let fetchedAt, false) = entry.content {
      entries.append(ListWidgetEntry(
        date: fetchedAt.addingTimeInterval(Self.showAgeAfter),
        content: .list(snapshot, fetchedAt: fetchedAt, showsAge: true)
      ))
    }
    return Timeline(entries: entries, policy: .after(.now.addingTimeInterval(Self.refreshInterval)))
  }

  private func load(_ configuration: SelectListIntent) async -> ListWidgetEntry {
    let listId = configuration.list?.id
    let attempt = await Self.attempt(listId: listId)
    let content = DomaWidgetContent.resolve(attempt, cache: DomaWidgetSnapshotCache(), key: listId ?? "default", now: .now)
    return ListWidgetEntry(date: .now, content: content)
  }

  @MainActor
  private static func attempt(listId: String?) async -> DomaWidgetContent.Attempt {
    do throws(WidgetSession.Failure) {
      let publicId: String
      if let listId {
        publicId = listId
      } else {
        let defaultList: DomaDefaultList? = try await WidgetSession.run("lists/queries:getDefaultList")
        guard let defaultList else { return .noDefaultList }
        publicId = defaultList.publicId
      }
      let snapshot: DomaWidgetSnapshot? = try await WidgetSession.run("lists/widget:getSnapshot", args: ["publicId": publicId])
      return snapshot.map { .loaded($0) } ?? .notVisible
    } catch .signedOut {
      return .signedOut
    } catch {
      return .networkFailure
    }
  }

}

private extension DomaWidgetContent {
  /// No list names or items: those stay out of the log.
  var logName: String {
    switch self {
    case .list(let snapshot, _, let showsAge): "list, \(snapshot.activeItems.count) items\(showsAge ? ", showing age" : "")"
    case .signedOut: "signed out"
    case .unavailable: "unavailable"
    case .noList: "no default list"
    case .failed: "failed"
    }
  }
}

extension DomaWidgetSnapshot {
  static let sample = DomaWidgetSnapshot(
    list: DomaListSummaryReference(publicId: "sample", name: "Shopping", slug: "shopping"),
    activeItems: ["Milk", "Bread", "Apples", "Coffee", "Rice"].enumerated().map {
      Item(id: "sample-\($0.offset)", title: $0.element)
    }
  )
}
