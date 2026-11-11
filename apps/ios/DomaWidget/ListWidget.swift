import DomaKit
import SwiftUI
import WidgetKit

struct ListWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: "DomaListWidget", intent: SelectListIntent.self, provider: ListWidgetProvider()) { entry in
      ListWidgetView(entry: entry)
        .containerBackground(DomaColor.warmBgCardSoft, for: .widget)
    }
    .configurationDisplayName("List")
    .description("Shows a list's active items. Your default list unless you choose another.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
