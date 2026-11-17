import SwiftUI
import WidgetKit

struct HomeWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: HomeWidgetProvider.kind, provider: HomeWidgetProvider()) { entry in
      HomeWidgetView(entry: entry)
        .containerBackground(DomaColor.warmBgCard, for: .widget)
    }
    .configurationDisplayName("Home")
    .description("What's next this week, the shopping count and the top note.")
    .contentMarginsDisabled()
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
  }
}
