import Charts
import DomaKit
import SwiftUI

/// Income vs Spending: a bar pair per month, the mortgage at the foot of spend, and dashed six-month
/// averages. Touching it picks a month and shows its figures, with Open month.
struct SpendingChart: View {
  /// How a touch picks a month.
  enum Reading {
    /// Inside a scroll view: a tap picks a month, and a short hold then a drag reads across, so a
    /// swipe still scrolls.
    case holdToDrag
    /// Full screen: any touch or drag reads.
    case drag
  }

  let model: SpendingChartModel
  let reading: Reading
  /// The most month labels the axis has room for.
  let maximumLabels: Int
  @Binding var selected: DomaMonth?
  let onOpen: (DomaMonth) -> Void
  @ScaledMetric(relativeTo: .footnote) private var calloutWidth: CGFloat = 220
  /// When a hold last moved or lifted, so its closing lift is not also taken as a tap.
  @State private var heldUntil: Date?

  var body: some View {
    Chart {
      if let selected {
        RectangleMark(x: .value("Month", selected.key), width: .ratio(0.9))
          .foregroundStyle(DomaColor.warmChip.opacity(0.8))
          .clipShape(.rect(cornerRadius: 8))
      }
      ForEach(model.bars) { bar in
        BarMark(
          x: .value("Month", bar.month.key),
          yStart: .value("From", bar.low),
          yEnd: .value("To", bar.high)
        )
        .position(by: .value("Slot", bar.slot.rawValue), axis: .horizontal, span: .ratio(0.75))
        .foregroundStyle(bar.series.color.opacity(isDimmed(bar.month) ? 0.35 : 1))
        .clipShape(
          UnevenRoundedRectangle(topLeadingRadius: bar.isTop ? 3 : 0, topTrailingRadius: bar.isTop ? 3 : 0))
      }
      ForEach(model.averages) { point in
        LineMark(x: .value("Month", point.month.key), y: .value("Average", point.value))
          .foregroundStyle(by: .value("Average", point.series.rawValue))
          .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round, dash: [5, 4]))
          .interpolationMethod(.monotone)
      }
    }
    .chartForegroundStyleScale([
      SpendingChartSeries.income.rawValue: DomaColor.warmPositiveText,
      SpendingChartSeries.spend.rawValue: DomaColor.warmNegativeText,
    ])
    .chartLegend(.hidden)
    .chartXScale(domain: model.months.map(\.month.key))
    .chartYScale(domain: model.valueDomain)
    .chartXAxis {
      // A mark for every month, labelled or not: a categorical axis ignores a subset of values.
      let labelled = Set(model.labelledMonths(fitting: maximumLabels))
      AxisMarks(values: model.months.map(\.month.key)) { value in
        AxisValueLabel(centered: true) {
          if let key = value.as(String.self), let month = DomaMonth(key: key), labelled.contains(month) {
            Text(model.axisLabel(for: month))
              .domaFont(month == selected ? .detailEmphasis : .detail)
              .foregroundStyle(month == selected ? DomaColor.warmTextPrimary : DomaColor.warmTextSecondary)
          }
        }
      }
    }
    .chartYAxis {
      AxisMarks(position: .trailing, values: .automatic(desiredCount: 3)) { value in
        AxisGridLine(stroke: StrokeStyle(lineWidth: 1, dash: [3, 3]))
          .foregroundStyle(DomaColor.warmBorder)
        AxisValueLabel {
          if let dollars = value.as(Double.self) {
            Text(SpendingFormat.axisAmount(dollars))
              .domaFont(.detail)
              .foregroundStyle(DomaColor.warmTextTertiary)
          }
        }
      }
    }
    .chartOverlay { proxy in
      GeometryReader { geometry in
        if let plot = proxy.plotFrame.map({ geometry[$0] }) {
          touchArea(proxy: proxy, plot: plot)
          if let selected, let month = model.month(selected), let center = proxy.position(forX: selected.key) {
            callout(for: month, at: plot.minX + center, plot: plot)
          }
        }
      }
    }
    .sensoryFeedback(.selection, trigger: selected)
    .accessibilityChartDescriptor(SpendingChartDescriptor(model: model))
  }

  private func isDimmed(_ month: DomaMonth) -> Bool { selected.map { $0 != month } ?? false }

  @ViewBuilder
  private func touchArea(proxy: ChartProxy, plot: CGRect) -> some View {
    let area = Rectangle().fill(.clear).contentShape(.rect)
      .frame(width: plot.width, height: plot.height)
      .position(x: plot.midX, y: plot.midY)
    switch reading {
    case .drag:
      area.gesture(
        DragGesture(minimumDistance: 0)
          .onChanged { selected = month(at: $0.location.x - plot.minX, proxy: proxy) }
      )
    case .holdToDrag:
      area
        .onTapGesture { location in
          // The lift that ends a hold can also land as a tap; it keeps the month the hold picked.
          if let heldUntil, Date.now.timeIntervalSince(heldUntil) < 0.3 { return }
          let month = month(at: location.x - plot.minX, proxy: proxy)
          selected = month == selected ? nil : month
        }
        // A UIKit hold: a SwiftUI hold-then-drag stops the scroll view taking a swipe that starts here.
        .gesture(SpendingChartHold { location in
          selected = month(at: location.x - plot.minX, proxy: proxy)
          heldUntil = .now
        })
    }
  }

  /// Beside the month's bars, on whichever side has room, at the top of the plot.
  private func callout(for month: DomaSpending.Month, at x: CGFloat, plot: CGRect) -> some View {
    let width = min(calloutWidth, plot.width)
    // Clear of the month's own bars, which fill most of its band.
    let gap = plot.width / CGFloat(max(model.months.count, 1)) / 2 + 4
    let fitsRight = x + gap + width <= plot.maxX
    let left = fitsRight ? x + gap : max(plot.minX, x - gap - width)
    return SpendingChartCallout(reading: SpendingChartReading(month)) { onOpen(month.month) }
      // Larger sizes would outgrow the plot; the month detail carries the same figures at any size.
      .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
      .frame(width: width)
      .fixedSize(horizontal: false, vertical: true)
      // A GeometryReader places its content at the top leading corner.
      .offset(x: left, y: plot.minY)
  }

  private func month(at x: CGFloat, proxy: ChartProxy) -> DomaMonth? {
    guard !model.months.isEmpty else { return nil }
    if let key = proxy.value(atX: x, as: String.self), let month = DomaMonth(key: key) { return month }
    // Outside the bands, the nearer end.
    return x < 0 ? model.months.first?.month : model.months.last?.month
  }
}

/// A short hold, then the touch's location as it moves and where it lifts.
private struct SpendingChartHold: UIGestureRecognizerRepresentable {
  let onMove: (CGPoint) -> Void

  func makeUIGestureRecognizer(context: Context) -> UILongPressGestureRecognizer {
    let recognizer = UILongPressGestureRecognizer()
    recognizer.minimumPressDuration = 0.2
    return recognizer
  }

  func handleUIGestureRecognizerAction(_ recognizer: UILongPressGestureRecognizer, context: Context) {
    guard [.began, .changed, .ended].contains(recognizer.state) else { return }
    onMove(context.converter.localLocation)
  }
}

/// VoiceOver's audio graph and chart summary: one point per month, income and spend.
private struct SpendingChartDescriptor: AXChartDescriptorRepresentable {
  let model: SpendingChartModel

  func makeChartDescriptor() -> AXChartDescriptor {
    let months = model.months
    let names = months.map { SpendingFormat.longMonthYear($0.month) }
    let high = Double(months.map { max($0.income, $0.spend) }.max() ?? 0) / 100
    let xAxis = AXCategoricalDataAxisDescriptor(title: "Month", categoryOrder: names)
    let yAxis = AXNumericDataAxisDescriptor(title: "Dollars", range: 0...max(high, 1), gridlinePositions: []) {
      SpendingFormat.money(Int(($0 * 100).rounded()))
    }
    let series = [
      AXDataSeriesDescriptor(
        name: "Income", isContinuous: false,
        dataPoints: zip(names, months).map { .init(x: $0, y: Double($1.income) / 100) }),
      AXDataSeriesDescriptor(
        name: "Spend", isContinuous: false,
        dataPoints: zip(names, months).map { .init(x: $0, y: Double($1.spend) / 100) }),
    ]
    return AXChartDescriptor(
      title: "Income vs spending", summary: nil, xAxis: xAxis, yAxis: yAxis, additionalAxes: [], series: series)
  }
}
