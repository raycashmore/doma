import CoreGraphics
import DomaKit

/// How a drag on the net strip changes the range: either end, or the whole range from its middle.
enum SpendingRangeDrag {
  enum Handle: Equatable {
    case from, to, whole
  }

  /// Half the 44 pt grab area around each end.
  static let grabRadius: CGFloat = 22

  /// What a drag starting at `x` moves. Within reach of an end, the nearer end wins, so a short
  /// range can still be widened. Inside the range it moves the whole range; outside, the end on
  /// that side jumps to the finger.
  static func handle(startingAt x: CGFloat, fromEdge: CGFloat, toEdge: CGFloat) -> Handle {
    let fromDistance = abs(x - fromEdge)
    let toDistance = abs(x - toEdge)
    if min(fromDistance, toDistance) <= grabRadius {
      if fromDistance == toDistance { return x < fromEdge ? .from : .to }
      return fromDistance < toDistance ? .from : .to
    }
    if x < fromEdge { return .from }
    if x > toEdge { return .to }
    return .whole
  }

  /// The range while `handle` is dragged from `start` to `current`, each the month under the
  /// finger. Ends never cross, and the whole range keeps its length inside `available`.
  static func range(
    dragging handle: Handle, original: DomaMonthRange, from start: DomaMonth, to current: DomaMonth,
    within available: DomaMonthRange
  ) -> DomaMonthRange {
    let month = min(max(current, available.from), available.to)
    switch handle {
    case .from:
      return DomaMonthRange(from: min(month, original.to), to: original.to) ?? original
    case .to:
      return DomaMonthRange(from: original.from, to: max(month, original.from)) ?? original
    case .whole:
      let lowest = original.from.months(to: available.from)
      let highest = original.to.months(to: available.to)
      let shift = min(max(start.months(to: current), lowest), highest)
      return DomaMonthRange(from: original.from.adding(months: shift), to: original.to.adding(months: shift)) ?? original
    }
  }
}
