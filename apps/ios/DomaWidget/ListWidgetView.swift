import DomaKit
import SwiftUI
import WidgetKit

struct ListWidgetView: View {
  let entry: ListWidgetEntry

  var body: some View {
    switch entry.content {
    case .list(let snapshot, let fetchedAt, let showsAge):
      ListWidgetListView(snapshot: snapshot, fetchedAt: fetchedAt, showsAge: showsAge)
        .widgetURL(DomaListLink.url(publicId: snapshot.list.publicId))
    case .signedOut:
      ListWidgetMessage(title: "Signed out", detail: "Open Doma to sign in.", systemImage: "person.crop.circle.badge.xmark")
    case .unavailable:
      ListWidgetMessage(title: "List unavailable", detail: "Edit the widget to choose another list.", systemImage: "lock")
    case .noList:
      ListWidgetMessage(title: "No default list", detail: "Edit the widget to choose a list.", systemImage: "checklist")
    case .failed:
      ListWidgetMessage(title: "Couldn't load the list", detail: "Doma will try again soon.", systemImage: "wifi.exclamationmark")
    }
  }
}

/// Widgets cannot scroll, so the list shows as many items as fit, then how many more there are.
private struct ListWidgetListView: View {
  let snapshot: DomaWidgetSnapshot
  let fetchedAt: Date
  let showsAge: Bool

  private static let maximumRows = 16

  private var items: [DomaWidgetSnapshot.Item] { snapshot.activeItems }

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(snapshot.list.name)
          .domaFont(.displayInline)
          .foregroundStyle(DomaColor.warmTextPrimary)
          .lineLimit(1)
        Spacer(minLength: 0)
        Text(items.count, format: .number)
          .domaFont(.count)
          .foregroundStyle(DomaColor.warmAccent)
          .accessibilityLabel("\(items.count) active")
      }
      if items.isEmpty {
        Text("All done")
          .domaFont(.supporting)
          .foregroundStyle(DomaColor.warmTextSecondary)
      } else {
        ViewThatFits(in: .vertical) {
          ForEach((0...min(items.count, Self.maximumRows)).reversed(), id: \.self) { shown in
            rows(shown: shown)
          }
        }
      }
      Spacer(minLength: 0)
      if showsAge {
        Text("Updated \(Text(fetchedAt, style: .relative)) ago")
          .domaFont(.detail)
          .foregroundStyle(DomaColor.warmTextSecondary)
          .lineLimit(1)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  private func rows(shown: Int) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      ForEach(items.prefix(shown), id: \.id) { item in
        HStack(spacing: 8) {
          Circle()
            .strokeBorder(DomaColor.checkRing, lineWidth: 1.5)
            .frame(width: 12, height: 12)
          Text(item.title)
            .domaFont(.supporting)
            .foregroundStyle(DomaColor.warmTextPrimary)
            .lineLimit(1)
        }
      }
      if shown < items.count {
        Text(shown == 0 ? "\(items.count) items" : "+\(items.count - shown) more")
          .domaFont(.detail)
          .foregroundStyle(DomaColor.warmTextTertiary)
      }
    }
  }
}

private struct ListWidgetMessage: View {
  let title: String
  let detail: String
  let systemImage: String

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Image(systemName: systemImage)
        .foregroundStyle(DomaColor.warmAccent)
      Text(title)
        .domaFont(.sectionHeader)
        .foregroundStyle(DomaColor.warmTextPrimary)
      Text(detail)
        .domaFont(.detail)
        .foregroundStyle(DomaColor.warmTextSecondary)
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}
