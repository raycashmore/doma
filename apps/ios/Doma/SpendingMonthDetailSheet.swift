import DomaKit
import SwiftUI

/// One month in full: its net, income, spend categories, one-offs and mortgage, with previous and
/// next across every month with data.
struct SpendingMonthDetailSheet: View {
  let session: DomaSession
  /// Every month with data, oldest first.
  let months: [DomaSpendingMonthNet]
  @State private var month: DomaMonth
  /// The month the detail belongs to, so stepping on never shows the last month's figures as this one's.
  @State private var loaded: (month: DomaMonth, detail: DomaSpendingMonthDetail?)?
  @State private var loadFailed = false
  @State private var attempt = 0
  @Environment(\.dismiss) private var dismiss
  @ScaledMetric(relativeTo: .footnote) private var stepSize: CGFloat = 36

  init(session: DomaSession, months: [DomaSpendingMonthNet], month: DomaMonth) {
    self.session = session
    self.months = months
    _month = State(initialValue: month)
  }

  private var stepper: SpendingMonthStepper { SpendingMonthStepper(months: months, current: month) }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      header
      ScrollView {
        content
          .padding(.horizontal, 20)
          .padding(.top, 8)
          .padding(.bottom, 40)
          .frame(maxWidth: 640, alignment: .leading)
          .frame(maxWidth: .infinity)
      }
    }
    .background(DomaColor.sheetBackground.ignoresSafeArea())
    .presentationDragIndicator(.visible)
    .sensoryFeedback(.selection, trigger: month)
    .task(id: Load(month: month, attempt: attempt)) {
      // The month this load is for: `month` may move on before the old subscription is cancelled.
      let target = month
      loadFailed = false
      guard let date = stepper.date else {
        loaded = (target, nil)
        return
      }
      await followLiveQuery("Spending month", subscribe: { session.spending.monthDetail(date: date) }) {
        loadFailed = true
      } onValue: { value in
        loaded = (target, value)
        loadFailed = false
      }
    }
  }

  private var header: some View {
    HStack {
      Button("Done") { dismiss() }
        .domaFont(.body)
        .foregroundStyle(DomaColor.warmTextSecondary)
        .frame(minWidth: 44, minHeight: 44, alignment: .leading)
        .contentShape(.rect)
      Spacer()
      HStack(spacing: 8) {
        stepButton(to: stepper.previous, systemImage: "chevron.left", label: "Previous month")
        stepButton(to: stepper.next, systemImage: "chevron.right", label: "Next month")
      }
    }
    .padding(.horizontal, 20)
    .padding(.top, 16)
  }

  private func stepButton(to target: DomaMonth?, systemImage: String, label: String) -> some View {
    Button {
      if let target { month = target }
    } label: {
      Image(systemName: systemImage)
        .domaFont(.detailEmphasis)
        .foregroundStyle(DomaColor.warmTextPrimary)
        .frame(width: stepSize, height: stepSize)
        .background(DomaColor.warmChip, in: .circle)
        .frame(minWidth: 44, minHeight: 44)
        .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .disabled(target == nil)
    .opacity(target == nil ? 0.4 : 1)
    .accessibilityLabel(target.map { "\(label), \(SpendingFormat.longMonthYear($0))" } ?? label)
  }

  @ViewBuilder
  private var content: some View {
    if let loaded, loaded.month == month {
      if let detail = loaded.detail {
        SpendingMonthDetailContent(month: month, prior: stepper.previous, detail: detail)
      } else {
        monthTitle
        Text("No figures for this month.")
          .domaFont(.supporting)
          .foregroundStyle(DomaColor.warmTextSecondary)
          .padding(.top, 16)
      }
    } else if loadFailed {
      monthTitle
      VStack(alignment: .leading, spacing: 8) {
        Text("This month is unavailable")
          .domaFont(.sectionHeader)
          .foregroundStyle(DomaColor.warmTextPrimary)
        Button {
          loadFailed = false
          attempt += 1
        } label: {
          Text("Retry")
            .domaFont(.button)
            .frame(minWidth: 88, minHeight: 44, alignment: .leading)
            .contentShape(.rect)
        }
      }
      .padding(.top, 16)
    } else {
      monthTitle
      ProgressView()
        .frame(maxWidth: .infinity)
        .padding(.top, 40)
    }
  }

  private var monthTitle: some View {
    Text(SpendingFormat.longMonthYear(month))
      .domaFont(.kicker)
      .tracking(1)
      .textCase(.uppercase)
      .foregroundStyle(DomaColor.warmTextSecondary)
      .accessibilityAddTraits(.isHeader)
  }

  private struct Load: Equatable {
    let month: DomaMonth
    let attempt: Int
  }
}
