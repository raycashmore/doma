import Charts
import DomaKit
import SwiftUI

/// Every month's net as a bar, with the range boxed. Drag either end, or the middle to move the
/// whole range; it snaps to months with a light tick. VoiceOver skips it: the chips and the month
/// grid set the same range.
struct SpendingRangeStrip: View {
  let months: [DomaSpendingMonthNet]
  let available: DomaMonthRange
  @Binding var range: DomaMonthRange
  @State private var drag: DragStart?
  /// A drag that began mostly vertical scrolls the sheet and leaves the range alone.
  @State private var isScrolling = false
  /// Resets on a cancelled gesture too (a call, Control Center), where `onEnded` never runs.
  @GestureState private var isDragging = false
  /// Room each year label needs, growing with the text.
  @ScaledMetric(relativeTo: .footnote) private var yearLabelWidth: CGFloat = 56
  @State private var tick = 0
  /// Grows with the year labels, so larger text does not squash the bars.
  @ScaledMetric(relativeTo: .footnote) private var height: CGFloat = 88

  private struct DragStart {
    let handle: SpendingRangeDrag.Handle
    let original: DomaMonthRange
    let month: DomaMonth
  }

  var body: some View {
    GeometryReader { geometry in
      let step = geometry.size.width / CGFloat(available.monthCount)
      chart(barWidth: max(1, step * 0.7), yearStride: max(1, Int((yearLabelWidth / (step * 12)).rounded(.up))))
    }
    .frame(height: height)
    .sensoryFeedback(.selection, trigger: tick)
    .onChange(of: isDragging) { _, dragging in
      if !dragging {
        drag = nil
        isScrolling = false
      }
    }
    .accessibilityHidden(true)
  }

  private func chart(barWidth: CGFloat, yearStride: Int) -> some View {
    Chart {
      RuleMark(y: .value("Zero", 0))
        .foregroundStyle(DomaColor.warmBorder)
        .lineStyle(StrokeStyle(lineWidth: 1))
      ForEach(months, id: \.month) { month in
        BarMark(
          x: .value("Month", index(of: month.month)),
          y: .value("Net", month.net),
          width: .fixed(barWidth)
        )
        .clipShape(.rect(cornerRadius: min(1.5, barWidth / 2)))
        .foregroundStyle(color(for: month))
      }
    }
    .chartXScale(domain: -0.5...(Double(available.monthCount) - 0.5))
    .chartYScale(domain: netDomain)
    .chartPlotStyle { $0.clipped() }
    .chartYAxis(.hidden)
    .chartXAxis {
      AxisMarks(values: januaries(every: yearStride)) { value in
        AxisTick(centered: true, length: 4, stroke: StrokeStyle(lineWidth: 1))
          .foregroundStyle(DomaColor.checkRing)
        AxisValueLabel(anchor: .topLeading) {
          if let index = value.as(Int.self) {
            Text(String(available.from.adding(months: index).year))
              .domaFont(.detail)
              .foregroundStyle(DomaColor.warmTextSecondary)
          }
        }
      }
    }
    .chartOverlay { proxy in
      GeometryReader { geometry in
        if let plot = proxy.plotFrame.map({ geometry[$0] }) {
          let fromEdge = plot.minX + (proxy.position(forX: Double(index(of: range.from)) - 0.5) ?? 0)
          let toEdge = plot.minX + (proxy.position(forX: Double(index(of: range.to)) + 0.5) ?? plot.width)
          selection(from: fromEdge, to: toEdge, plot: plot)
          Color.clear
            .contentShape(.rect)
            .simultaneousGesture(
              DragGesture(minimumDistance: 6)
                .updating($isDragging) { _, state, _ in state = true }
                .onChanged { value in
                  if drag == nil {
                    isScrolling = isScrolling || abs(value.translation.height) > abs(value.translation.width)
                  }
                  guard !isScrolling else { return }
                  let current = month(at: value.location.x - plot.minX, proxy: proxy)
                  let start = drag ?? DragStart(
                    handle: SpendingRangeDrag.handle(
                      startingAt: value.startLocation.x, fromEdge: fromEdge, toEdge: toEdge),
                    original: range,
                    month: month(at: value.startLocation.x - plot.minX, proxy: proxy))
                  drag = start
                  let next = SpendingRangeDrag.range(
                    dragging: start.handle, original: start.original, from: start.month, to: current,
                    within: available)
                  if next != range {
                    range = next
                    tick += 1
                  }
                }

            )
        }
      }
    }
  }

  private func selection(from fromEdge: CGFloat, to toEdge: CGFloat, plot: CGRect) -> some View {
    // Wide enough that the grips stay apart however short the range.
    let width = max(toEdge - fromEdge, 16)
    let box = CGRect(x: (fromEdge + toEdge - width) / 2, y: plot.minY + 2, width: width, height: plot.height - 4)
    return ZStack {
      RoundedRectangle(cornerRadius: 6)
        .fill(DomaColor.warmPositive.opacity(0.08))
        .strokeBorder(DomaColor.warmTextPrimary, lineWidth: 1.5)
        .frame(width: box.width, height: box.height)
        .position(x: box.midX, y: box.midY)
      grip.position(x: box.minX, y: box.midY)
      grip.position(x: box.maxX, y: box.midY)
    }
    .allowsHitTesting(false)
  }

  private var grip: some View {
    Capsule()
      .fill(DomaColor.warmBgCard)
      .strokeBorder(DomaColor.warmTextPrimary, lineWidth: 1.5)
      .overlay {
        Capsule().fill(DomaColor.warmTextPrimary).frame(width: 1.2, height: 10)
      }
      .frame(width: 8, height: 28)
  }

  /// Up to one and a half times the 90th-percentile month, so one unusual month does not flatten
  /// the rest; taller bars are clipped.
  private var netDomain: ClosedRange<Int> {
    let sizes = months.map { abs($0.net) }.sorted()
    guard !sizes.isEmpty else { return -1...1 }
    let typical = sizes[min(sizes.count - 1, sizes.count * 9 / 10)]
    let limit = max(typical * 3 / 2, 1)
    let low = max(months.map(\.net).min() ?? 0, -limit)
    let high = min(months.map(\.net).max() ?? 0, limit)
    return min(low, 0)...max(high, 1)
  }

  private func index(of month: DomaMonth) -> Int { available.from.months(to: month) }

  private func month(at x: CGFloat, proxy: ChartProxy) -> DomaMonth {
    let position = proxy.value(atX: x, as: Double.self) ?? 0
    let index = min(max(Int(position.rounded()), 0), available.monthCount - 1)
    return available.from.adding(months: index)
  }

  private func januaries(every stride: Int) -> [Int] {
    (0..<available.monthCount).filter {
      let month = available.from.adding(months: $0)
      return month.month == 1 && month.year % stride == 0
    }
  }

  private func color(for month: DomaSpendingMonthNet) -> Color {
    let base = month.net < 0 ? DomaColor.warmAccent : DomaColor.warmPositive
    return range.contains(month.month) ? base : base.opacity(0.3)
  }
}
