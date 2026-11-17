import DomaKit
import SwiftUI

/// How much room a card asks for in the bento, as `flex: <weight> 1 <basis>` does on the web.
nonisolated struct BentoSize {
  var weight: CGFloat
  var basis: CGFloat
  /// The basis below the web's 1120 px breakpoint, such as iPad in portrait.
  var narrowBasis: CGFloat
}

extension BentoSize {
  /// The weights of `.active-board` in `apps/home/src/styles.css`. Today's and spending's widths are
  /// smaller than the web's, so any two cards share a row on an 11-inch iPad in landscape.
  init(for item: DomaBoardItem) {
    switch item {
    case .today: (weight, basis, narrowBasis) = (2, 460, 420)
    case .meals: (weight, basis, narrowBasis) = (1, 280, 220)
    case .spendingInsight: (weight, basis, narrowBasis) = (2, 520, 480)
    default: (weight, basis, narrowBasis) = item.display == .wide ? (1.35, 390, 340) : (1, 300, 300)
    }
  }
}

private nonisolated struct BentoSizeKey: LayoutValueKey {
  static let defaultValue = BentoSize(weight: 1, basis: 300, narrowBasis: 300)
}

extension View {
  func bentoSize(_ size: BentoSize) -> some View {
    layoutValue(key: BentoSizeKey.self, value: size)
  }
}

/// The iPad noticeboard: cards fill each row by weight and wrap when their widths no longer fit,
/// like the web's flex-wrap. Cards in a row share the tallest one's height.
struct BoardBentoLayout: Layout {
  var spacing: CGFloat = 16

  private struct Row {
    var indices: [Int]
    var widths: [CGFloat]
    var height: CGFloat
  }

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let width = proposal.width ?? subviews.reduce(0) { $0 + $1[BentoSizeKey.self].basis }
    let rows = rows(width: width, subviews: subviews)
    let height = rows.reduce(0) { $0 + $1.height } + spacing * CGFloat(max(rows.count - 1, 0))
    return CGSize(width: width, height: height)
  }

  func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
    var y = bounds.minY
    for row in rows(width: bounds.width, subviews: subviews) {
      var x = bounds.minX
      for (index, width) in zip(row.indices, row.widths) {
        subviews[index].place(
          at: CGPoint(x: x, y: y), proposal: ProposedViewSize(width: width, height: row.height))
        x += width + spacing
      }
      y += row.height + spacing
    }
  }

  private func rows(width: CGFloat, subviews: Subviews) -> [Row] {
    let sizes = subviews.map { $0[BentoSizeKey.self] }
    return BentoRows.rows(of: sizes, width: width, spacing: spacing).map { row in
      let height = row.map { card in
        subviews[card.index].sizeThatFits(ProposedViewSize(width: card.width, height: nil)).height
      }.max() ?? 0
      return Row(indices: row.map(\.index), widths: row.map(\.width), height: height)
    }
  }
}

/// Where the bento's cards go: which share a row, and how wide each is.
nonisolated enum BentoRows {
  struct Card: Equatable {
    let index: Int
    let width: CGFloat
  }

  static func rows(of sizes: [BentoSize], width: CGFloat, spacing: CGFloat) -> [[Card]] {
    // The web switches at a 1120 px window; the board sits 32 pt in from each side.
    let isNarrow = width <= 1120 - 64
    let basis = { (size: BentoSize) in isNarrow ? size.narrowBasis : size.basis }
    var groups: [[Int]] = []
    var used: CGFloat = 0
    for (index, size) in sizes.enumerated() {
      if let last = groups.indices.last, used + spacing + basis(size) <= width {
        groups[last].append(index)
        used += spacing + basis(size)
      } else {
        groups.append([index])
        used = basis(size)
      }
    }
    return groups.map { indices in
      let row = indices.map { sizes[$0] }
      let free = width - spacing * CGFloat(indices.count - 1) - row.reduce(0) { $0 + basis($1) }
      let weights = row.reduce(0) { $0 + $1.weight }
      return zip(indices, row).map { index, size in
        // A lone card wider than the row shrinks to fit it.
        Card(index: index, width: min(width, max(0, basis(size) + free * size.weight / weights)))
      }
    }
  }
}
