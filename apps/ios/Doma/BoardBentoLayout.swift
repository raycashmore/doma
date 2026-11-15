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
  /// The same weights and widths as `.active-board` in `apps/home/src/styles.css`.
  init(for item: DomaBoardItem) {
    switch item {
    case .today: (weight, basis, narrowBasis) = (2, 520, 420)
    case .meals: (weight, basis, narrowBasis) = (1, 280, 220)
    case .spendingInsight: (weight, basis, narrowBasis) = (2, 600, 480)
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
    // The web switches at a 1120 px window; the board sits 32 pt in from each side.
    let isNarrow = width <= 1120 - 64
    let basis = { (size: BentoSize) in isNarrow ? size.narrowBasis : size.basis }
    var groups: [[Int]] = []
    var used: CGFloat = 0
    for index in subviews.indices {
      let cardBasis = basis(subviews[index][BentoSizeKey.self])
      if let last = groups.indices.last, used + spacing + cardBasis <= width {
        groups[last].append(index)
        used += spacing + cardBasis
      } else {
        groups.append([index])
        used = cardBasis
      }
    }
    return groups.map { indices in
      let sizes = indices.map { subviews[$0][BentoSizeKey.self] }
      let gaps = spacing * CGFloat(indices.count - 1)
      let free = width - gaps - sizes.reduce(0) { $0 + basis($1) }
      let weights = sizes.reduce(0) { $0 + $1.weight }
      // A lone card wider than the row shrinks to fit it.
      let widths = sizes.map { min(width, max(0, basis($0) + free * $0.weight / weights)) }
      let height = zip(indices, widths).map { index, cardWidth in
        subviews[index].sizeThatFits(ProposedViewSize(width: cardWidth, height: nil)).height
      }.max() ?? 0
      return Row(indices: indices, widths: widths, height: height)
    }
  }
}
