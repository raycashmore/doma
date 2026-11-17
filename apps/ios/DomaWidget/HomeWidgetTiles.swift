import DomaKit
import SwiftUI
import WidgetKit

/// A soft tile on the widget. A tile that `fills` takes the height its column leaves; the rest
/// are one-line tiles of one height, so side-by-side ones line up.
struct HomeTile<Content: View>: View {
  var fills = true
  @ViewBuilder let content: Content
  @ScaledMetric(relativeTo: .headline) private var lineTileHeight: CGFloat = 38

  var body: some View {
    content
      .padding(.horizontal, 10)
      .padding(.vertical, fills ? 8 : 0)
      .frame(maxWidth: .infinity, maxHeight: fills ? .infinity : nil, alignment: fills ? .topLeading : .leading)
      .frame(height: fills ? nil : lineTileHeight)
      // Concentric with the widget's corners, whatever the device's radius.
      .background(DomaColor.warmBgCardSoft, in: ContainerRelativeShape())
  }
}

/// The widget draws its own margins, so tiles sit closer to the edge than the system's.
enum HomeTileSpacing {
  static let inset: CGFloat = 8
  static let gap: CGFloat = 6
}

private struct HomeKicker: View {
  let title: String
  var dot = false

  var body: some View {
    HStack(spacing: 6) {
      if dot { HomeNoteDot() }
      Text(title)
        .domaFont(.kicker)
        .tracking(1)
        .textCase(.uppercase)
        .foregroundStyle(DomaColor.warmTextSecondary)
    }
  }
}

private struct HomeNoteDot: View {
  var body: some View {
    Circle()
      .fill(DomaColor.warmAccent)
      .frame(width: 6, height: 6)
  }
}

/// The clock time leads; the countdown is a quiet second line. Another day shows its name instead.
struct HomeNextTile: View {
  let event: DomaHomeWidgetSummary.Event
  let now: Date
  /// The event's detail after the countdown, where there is room.
  let showsDetail: Bool

  private var format: DomaHomeWidgetFormat { DomaHomeWidgetFormat() }

  var body: some View {
    let clock = format.clock(event.startDate)
    VStack(alignment: .leading, spacing: 2) {
      HomeKicker(title: "Next")
      HStack(alignment: .firstTextBaseline, spacing: 2) {
        Text(clock.time).domaFont(.displaySmall)
        Text(clock.period).domaFont(.displayInline)
      }
      .foregroundStyle(DomaColor.warmAccent)
      .lineLimit(1)
      .minimumScaleFactor(0.8)
      Text(event.title)
        .domaFont(.sectionHeader)
        .foregroundStyle(DomaColor.warmTextPrimary)
        .lineLimit(1)
      whenLine
        .domaFont(.detail)
        .foregroundStyle(DomaColor.warmTextSecondary)
        .lineLimit(1)
    }
  }

  /// One interpolated Text: a countdown in its own view next to the detail takes the whole width.
  private var whenLine: Text {
    guard showsDetail, let detail = event.detail else { return when }
    return Text("\(when) · \(detail)")
  }

  private var when: Text {
    if event.startDate <= now { return Text("Now") }
    if let day = format.day(event.startDate, now: now) { return Text(day) }
    // WidgetKit keeps this counting down between timeline entries.
    return Text(.currentDate, format: .reference(to: event.startDate, allowedFields: [.hour, .minute]))
  }
}

/// The events after Next, time first. "+N more" sits beside the label to leave room for three
/// rows; fewer show when larger text leaves no room.
struct HomeWeekTile: View {
  let board: DomaHomeWidgetBoard

  private var format: DomaHomeWidgetFormat { DomaHomeWidgetFormat() }

  var body: some View {
    let most = min(board.week.count, DomaHomeWidgetBoard.weekRowLimit)
    ViewThatFits(in: .vertical) {
      ForEach((1...max(most, 1)).reversed(), id: \.self) { shown in
        rows(shown: shown)
      }
    }
  }

  private func rows(shown: Int) -> some View {
    let more = board.moreCount(shown: shown)
    return VStack(alignment: .leading, spacing: 3) {
      HStack(alignment: .firstTextBaseline) {
        HomeKicker(title: "This week")
        Spacer(minLength: 4)
        if more > 0 {
          Text("+\(more) more")
            .domaFont(.kicker)
            .foregroundStyle(DomaColor.warmTextTertiary)
            .fixedSize()
        }
      }
      Grid(alignment: .leading, horizontalSpacing: 8, verticalSpacing: 2) {
        ForEach(board.week.prefix(shown)) { event in
          GridRow(alignment: .firstTextBaseline) {
            // The time keeps its width; the title truncates.
            Text(format.rowLead(event, now: board.date))
              .domaFont(.detail)
              .foregroundStyle(DomaColor.warmTextSecondary)
              .fixedSize()
            Text(event.title)
              .domaFont(.supporting)
              .foregroundStyle(DomaColor.warmTextPrimary)
          }
          .lineLimit(1)
        }
      }
    }
  }
}

/// The list's name and how many items are still to get.
struct HomeListTile: View {
  let list: DomaHomeWidgetSummary.List
  /// The only tile in its column, so the count can be large.
  let isLarge: Bool

  var body: some View {
    HStack(alignment: isLarge ? .top : .center, spacing: 6) {
      Circle()
        .strokeBorder(DomaColor.checkRing, lineWidth: 1.5)
        .frame(width: 12, height: 12)
      Text(list.name)
        .domaFont(.supporting)
        .foregroundStyle(DomaColor.warmTextPrimary)
        .lineLimit(1)
        .minimumScaleFactor(0.85)
      Spacer(minLength: 2)
      Text(list.activeCount, format: .number)
        .domaFont(isLarge ? .displaySmall : .sectionHeader)
        .foregroundStyle(DomaColor.warmAccent)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(list.name), \(list.activeCount) to get")
  }
}

/// The top note: one line under another tile, or as many lines as fit when it leads.
struct HomeNoteTile: View {
  let note: DomaHomeWidgetSummary.Note
  let isLarge: Bool

  var body: some View {
    if isLarge {
      VStack(alignment: .leading, spacing: 4) {
        HomeKicker(title: "Note", dot: true)
        Text(note.title)
          .domaFont(.supporting)
          .foregroundStyle(DomaColor.warmTextPrimary)
      }
    } else {
      HStack(spacing: 8) {
        HomeNoteDot()
        Text(note.title)
          .domaFont(.supporting)
          .foregroundStyle(DomaColor.warmTextPrimary)
          .lineLimit(1)
      }
    }
  }
}

/// Nothing booked, listed or pinned: the widget calms to one line.
struct HomeAllClear: View {
  let isSmall: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("All clear")
        .domaFont(.displaySmall)
        .foregroundStyle(DomaColor.warmTextPrimary)
      Text("Nothing booked, listed or pinned this week")
        .domaFont(.detail)
        .foregroundStyle(DomaColor.warmTextSecondary)
    }
    .frame(maxHeight: .infinity, alignment: isSmall ? .center : .leading)
  }
}
