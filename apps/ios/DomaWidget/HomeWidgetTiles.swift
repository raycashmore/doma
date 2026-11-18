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

/// Today's next event. The countdown sits beside the kicker, the clock time leads, then the title.
/// Once the event is under way, the kicker counts down to its end and the time is when it ends.
/// Daily requirements show one row per person under the time instead, and when those rows do not
/// fit, the time shrinks to one line of text.
struct HomeNextTile: View {
  let event: DomaHomeWidgetSummary.Event
  /// The event's end, or the last end among the requirement rows.
  let end: Date
  let requirementRows: [DomaHomeWidgetBoard.RequirementRow]
  let now: Date

  private var clock: (lead: String?, time: String, period: String) {
    DomaHomeWidgetFormat().nextClock(start: event.startDate, end: end, now: now)
  }

  private var isUnderWay: Bool { event.startDate <= now }

  var body: some View {
    if requirementRows.isEmpty {
      VStack(alignment: .leading, spacing: 2) {
        kicker
        largeClock
        Text(event.title)
          .domaFont(.sectionHeader)
          .foregroundStyle(DomaColor.warmTextPrimary)
          .lineLimit(1)
        if let detail = event.detail {
          Text(detail)
            .domaFont(.detail)
            .foregroundStyle(DomaColor.warmTextSecondary)
            .lineLimit(1)
        }
      }
    } else {
      ViewThatFits(in: .vertical) {
        VStack(alignment: .leading, spacing: 2) {
          kicker
          largeClock
          HomeRequirementRows(rows: requirementRows)
        }
        ForEach((1...requirementRows.count).reversed(), id: \.self) { shown in
          VStack(alignment: .leading, spacing: 2) {
            kicker
            Text([clock.lead, "\(clock.time)\(clock.period)"].compactMap(\.self).joined(separator: " "))
              .domaFont(.displayInline)
              .foregroundStyle(DomaColor.warmAccent)
              .lineLimit(1)
            HomeRequirementRows(rows: Array(requirementRows.prefix(shown)))
          }
        }
      }
    }
  }

  /// "NEXT · in 57 minutes", or "NOW · ends in 30 minutes": only the label is tracked, and the
  /// line shrinks a little to keep the countdown whole in a small widget.
  private var kicker: some View {
    Text("\(Text(isUnderWay ? "NOW" : "NEXT").tracking(1)) · \(when)")
      .domaFont(.kicker)
      .foregroundStyle(DomaColor.warmTextSecondary)
      .lineLimit(1)
      .minimumScaleFactor(0.8)
  }

  private var largeClock: some View {
    HStack(alignment: .firstTextBaseline, spacing: 2) {
      if let lead = clock.lead {
        Text(lead)
          .domaFont(.displayInline)
          .foregroundStyle(DomaColor.warmTextSecondary)
          .padding(.trailing, 4)
      }
      Text(clock.time).domaFont(.displaySmall)
      Text(clock.period).domaFont(.displayInline)
    }
    .foregroundStyle(DomaColor.warmAccent)
    .lineLimit(1)
    .minimumScaleFactor(0.8)
  }

  /// A live countdown to the start, or once under way to the end, joined into the kicker's one
  /// Text: in its own view it takes the whole width.
  private var when: Text {
    // WidgetKit keeps this counting down between timeline entries.
    let countdown = Text(
      .currentDate, format: .reference(to: isUnderWay ? end : event.startDate, allowedFields: [.hour, .minute]))
    return isUnderWay ? Text("ends \(countdown)") : countdown
  }
}

/// Who, then what they need: the names line up in one column.
private struct HomeRequirementRows: View {
  let rows: [DomaHomeWidgetBoard.RequirementRow]

  var body: some View {
    Grid(alignment: .leading, horizontalSpacing: 7, verticalSpacing: 0) {
      ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
        GridRow(alignment: .firstTextBaseline) {
          if let who = row.who {
            Text(who)
              .domaFont(.detail)
              .bold()
              .foregroundStyle(DomaColor.warmTextSecondary)
              .fixedSize()
          } else {
            Color.clear.gridCellUnsizedAxes([.horizontal, .vertical])
          }
          Text(row.what)
            .domaFont(.supporting)
            .bold()
            .foregroundStyle(DomaColor.warmTextPrimary)
        }
        .lineLimit(1)
      }
    }
  }
}

/// The events after Next, as many rows as fit.
struct HomeWeekTile: View {
  let board: DomaHomeWidgetBoard

  private var format: DomaHomeWidgetFormat { DomaHomeWidgetFormat() }

  var body: some View {
    ViewThatFits(in: .vertical) {
      ForEach((1...max(board.week.count, 1)).reversed(), id: \.self) { shown in
        rows(shown: shown)
      }
    }
  }

  private func rows(shown: Int) -> some View {
    VStack(alignment: .leading, spacing: 3) {
      HomeKicker(title: "This week")
      Grid(alignment: .leading, horizontalSpacing: 8, verticalSpacing: 2) {
        ForEach(board.week.prefix(shown)) { event in
          GridRow(alignment: .firstTextBaseline) {
            // The day or time keeps its width; the title truncates.
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
