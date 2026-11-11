import SwiftUI
import WidgetKit

/// Spike: shows the default list, read with the app's shared Clerk session.
struct DomaListWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "DomaListWidget", provider: ListSnapshotProvider()) { entry in
      ListSnapshotView(entry: entry)
        .containerBackground(.background, for: .widget)
    }
    .configurationDisplayName("List")
    .description("Shows a list's active items.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}

struct ListSnapshotEntry: TimelineEntry {
  enum Content {
    case snapshot(name: String, items: [String])
    case message(String)
  }

  let date: Date
  let content: Content
}

struct ListSnapshotProvider: TimelineProvider {
  func placeholder(in context: Context) -> ListSnapshotEntry {
    ListSnapshotEntry(date: .now, content: .snapshot(name: "Shopping", items: ["Milk", "Bread", "Apples"]))
  }

  func getSnapshot(in context: Context, completion: @escaping @Sendable (ListSnapshotEntry) -> Void) {
    completion(placeholder(in: context))
  }

  func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<ListSnapshotEntry>) -> Void) {
    Task {
      let content = await WidgetListLoader.loadDefaultList()
      let entry = ListSnapshotEntry(date: .now, content: content)
      completion(Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(30 * 60))))
    }
  }
}

struct ListSnapshotView: View {
  let entry: ListSnapshotEntry

  var body: some View {
    switch entry.content {
    case .snapshot(let name, let items):
      VStack(alignment: .leading, spacing: 4) {
        Text(name).font(.headline)
        Text("\(items.count) active").font(.caption).foregroundStyle(.secondary)
        ForEach(Array(items.prefix(6).enumerated()), id: \.offset) { _, title in
          Text(title).font(.subheadline).lineLimit(1)
        }
        Spacer(minLength: 0)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    case .message(let text):
      Text(text).font(.caption).foregroundStyle(.secondary)
    }
  }
}
