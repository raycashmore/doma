import DomaKit
import SwiftUI
import WidgetKit

struct HomeWidgetView: View {
  let entry: HomeWidgetEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    switch entry.content {
    case .board(let board) where family == .accessoryRectangular:
      HomeLockScreenView(board: board)
    case .board(let board) where board.isAllClear:
      HomeTile { HomeAllClear(isSmall: family == .systemSmall) }
        .padding(HomeTileSpacing.inset)
        .widgetURL(DomaHomeLink.board.url)
    case .board(let board):
      HomeBoardView(board: board, isSmall: family == .systemSmall)
    case .signedOut:
      HomeWidgetMessage(title: "Signed out", detail: "Open Doma to sign in.", isLockScreen: family == .accessoryRectangular)
    case .failed:
      HomeWidgetMessage(title: "Couldn't load", detail: "Doma will try again soon.", isLockScreen: family == .accessoryRectangular)
    }
  }
}

/// Columns of tiles. The first tile in a column takes the height the ones below it leave.
private struct HomeBoardView: View {
  let board: DomaHomeWidgetBoard
  let isSmall: Bool

  private var columns: [[DomaHomeWidgetBoard.Tile]] { isSmall ? [board.smallTiles] : board.mediumColumns }

  var body: some View {
    HStack(spacing: HomeTileSpacing.gap) {
      ForEach(Array(columns.enumerated()), id: \.offset) { _, column in
        VStack(spacing: HomeTileSpacing.gap) {
          ForEach(Array(column.enumerated()), id: \.offset) { index, tile in
            HomeBoardTile(board: board, tile: tile, leads: index == 0, isSmall: isSmall)
          }
        }
      }
    }
    .padding(HomeTileSpacing.inset)
    // A small widget takes one tap target, so it opens what its first tile is about.
    .widgetURL(isSmall ? columns.first?.first.flatMap(destination) : DomaHomeLink.board.url)
  }

  private func destination(_ tile: DomaHomeWidgetBoard.Tile) -> URL? {
    switch tile {
    case .next, .week: DomaCalendarLink.url
    case .list: board.list.flatMap { DomaListLink.url(publicId: $0.publicId) }
    case .note: board.note.flatMap { DomaHomeLink.item($0.boardItemId).url }
    }
  }
}

private struct HomeBoardTile: View {
  let board: DomaHomeWidgetBoard
  let tile: DomaHomeWidgetBoard.Tile
  /// The first tile in its column: it fills the height left over.
  let leads: Bool
  let isSmall: Bool

  var body: some View {
    switch tile {
    case .next:
      if let next = board.next {
        link(DomaCalendarLink.url) { HomeNextTile(event: next, now: board.date, showsDetail: !isSmall) }
      }
    case .week:
      link(DomaCalendarLink.url) { HomeWeekTile(board: board) }
    case .list:
      if let list = board.list {
        link(DomaListLink.url(publicId: list.publicId)) { HomeListTile(list: list, isLarge: leads) }
      }
    case .note:
      if let note = board.note {
        link(DomaHomeLink.item(note.boardItemId).url) { HomeNoteTile(note: note, isLarge: leads) }
      }
    }
  }

  /// Small widgets ignore `Link`; their `widgetURL` covers the whole widget.
  @ViewBuilder
  private func link(_ url: URL?, @ViewBuilder content: () -> some View) -> some View {
    let tile = HomeTile(fills: leads, content: content)
    if let url, !isSmall {
      Link(destination: url) { tile }
    } else {
      tile
    }
  }
}

/// Up to three monochrome lines: Next, then the first event after it or the note, then the list.
private struct HomeLockScreenView: View {
  let board: DomaHomeWidgetBoard

  private var format: DomaHomeWidgetFormat { DomaHomeWidgetFormat() }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      if board.isAllClear {
        Text("All clear this week").domaFont(.sectionHeader)
      }
      ForEach(Array(board.lockScreenTiles.enumerated()), id: \.offset) { index, tile in
        Text(line(tile))
          .domaFont(index == 0 ? .sectionHeader : .supporting)
          .foregroundStyle(index == 0 ? .primary : .secondary)
          .lineLimit(1)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .widgetAccentable()
    .widgetURL(DomaHomeLink.board.url)
  }

  private func line(_ tile: DomaHomeWidgetBoard.Tile) -> String {
    switch tile {
    case .next: board.next.map { "\(format.rowLead($0, now: board.date)) \($0.title)" } ?? ""
    case .week: board.week.first.map { "\(format.rowLead($0, now: board.date)) \($0.title)" } ?? ""
    case .list: board.list.map { "\($0.name) · \($0.activeCount)" } ?? ""
    case .note: board.note?.title ?? ""
    }
  }
}

private struct HomeWidgetMessage: View {
  let title: String
  let detail: String
  let isLockScreen: Bool

  var body: some View {
    let message = VStack(alignment: .leading, spacing: 4) {
      Text(title)
        .domaFont(.sectionHeader)
        .foregroundStyle(isLockScreen ? AnyShapeStyle(.primary) : AnyShapeStyle(DomaColor.warmTextPrimary))
      Text(detail)
        .domaFont(.detail)
        .foregroundStyle(isLockScreen ? AnyShapeStyle(.secondary) : AnyShapeStyle(DomaColor.warmTextSecondary))
    }
    if isLockScreen {
      message.frame(maxWidth: .infinity, alignment: .leading)
    } else {
      HomeTile { message }.padding(HomeTileSpacing.inset)
    }
  }
}
