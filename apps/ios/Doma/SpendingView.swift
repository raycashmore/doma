import DomaKit
import SwiftUI

/// The household's spending over a chosen run of months: the overview card and the months.
/// The server does all the maths (`packages/convex/convex/spending.ts`); this only shows it.
struct SpendingView: View {
  let session: DomaSession
  /// Every month's net, oldest first: what the presets resolve against and the strip draws.
  @State private var months: [DomaSpendingMonthNet]?
  @State private var choice = SpendingRangeChoice.initial
  @State private var spending: DomaSpending?
  @State private var loadFailed = false
  /// Moves on with Retry, so both subscriptions start again.
  @State private var attempt = 0
  @State private var isChoosingRange = false
  @State private var openMonth: DomaSpending.Month?
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  private var available: DomaMonthRange? {
    guard let first = months?.first, let last = months?.last else { return nil }
    return DomaMonthRange(from: first.month, to: last.month)
  }

  /// `nil` until the months arrive.
  private var range: DomaMonthRange? { available.flatMap { choice.range(within: $0) } }

  var body: some View {
    NavigationStack {
      content
        .domaHeaderedSheet(
          title: Text("Spending"),
          kicker: months?.last.map { Text(SpendingFormat.updated($0.date)) })
    }
    .tint(DomaColor.warmTextPrimary)
    .task(id: attempt) {
      await followLiveQuery("Spending months", subscribe: { session.spending.months() }) {
        loadFailed = true
      } onValue: { value in
        months = value
        loadFailed = false
      }
    }
    .task(id: RangeLoad(range: range, attempt: attempt)) {
      guard let range else { return }
      await followLiveQuery("Spending", subscribe: { session.spending.spending(in: range) }) {
        loadFailed = true
      } onValue: { value in
        spending = value
        loadFailed = false
      }
    }
    .sheet(isPresented: $isChoosingRange) {
      if let months, let available {
        SpendingRangeSheet(months: months, available: available, initial: choice) { choice = $0 }
      }
    }
    .sheet(item: $openMonth) { month in
      SpendingMonthPlaceholderSheet(month: month)
    }
  }

  @ViewBuilder
  private var content: some View {
    if let months, months.isEmpty {
      DomaStateView(
        title: "No spending yet", systemImage: "dollarsign.circle",
        message: "Months appear here once the budget is filled in.")
    } else if let spending, let range {
      ScrollView {
        VStack(alignment: .leading, spacing: 20) {
          SpendingOverviewCard(spending: spending, range: range) { isChoosingRange = true }
          SpendingMonthsSection(months: spending.months) { openMonth = $0 }
        }
        // A new range keeps the last figures, faded, until its own arrive.
        .opacity(spending.from == range.from && spending.to == range.to ? 1 : 0.5)
        .animation(.easeOut(duration: 0.2), value: spending)
        .padding(.horizontal, horizontalSizeClass == .regular ? 32 : 16)
        .padding(.vertical, 20)
      }
    } else if loadFailed {
      VStack(spacing: 12) {
        Text("Spending is unavailable")
          .domaFont(.sectionHeader)
          .foregroundStyle(DomaColor.warmTextPrimary)
        Button {
          loadFailed = false
          attempt += 1
        } label: {
          Text("Retry")
            .domaFont(.button)
            .frame(minWidth: 88, minHeight: 44)
            .contentShape(.rect)
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    } else {
      ProgressView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
  }

  private struct RangeLoad: Equatable {
    let range: DomaMonthRange?
    let attempt: Int
  }
}
