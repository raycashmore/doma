import DomaKit
import SwiftUI

/// The month's card spend by category, largest first with a bar each, then Show all and one-offs.
struct SpendingCategoryCard: View {
  let categories: [DomaSpendingMonthDetail.Category]
  let oneOffs: Int
  @State private var showsAll = false

  private var preview: SpendingCategoryPreview { SpendingCategoryPreview(categories: categories, showsAll: showsAll) }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      if categories.isEmpty {
        Text("No categories for this month.")
          .domaFont(.supporting)
          .foregroundStyle(DomaColor.warmTextSecondary)
      } else {
        ForEach(preview.shown, id: \.category) { category in
          row(category)
        }
      }
      footer
    }
    .padding(16)
    .domaCardSurface()
    // A new month starts with the short list.
    .onChange(of: categories) { showsAll = false }
  }

  private func row(_ category: DomaSpendingMonthDetail.Category) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 12) {
        Text(category.category)
          .frame(maxWidth: .infinity, alignment: .leading)
        Text(SpendingFormat.money(category.amount))
          .monospacedDigit()
      }
      .domaFont(.supporting)
      .foregroundStyle(DomaColor.warmTextPrimary)
      Capsule()
        .fill(DomaColor.warmChip)
        .frame(height: 6)
        .overlay(alignment: .leading) {
          GeometryReader { geometry in
            Capsule()
              .fill(DomaColor.warmAccent)
              .frame(width: geometry.size.width * preview.share(of: category))
          }
        }
        .accessibilityHidden(true)
    }
    .accessibilityElement(children: .combine)
  }

  private var footer: some View {
    VStack(spacing: 0) {
      if !categories.isEmpty {
        Rectangle().fill(DomaColor.warmBorder).frame(height: 1)
      }
      HStack(spacing: 12) {
        if preview.canExpand {
          Button {
            withAnimation(.snappy) { showsAll.toggle() }
          } label: {
            Text(showsAll ? "Show fewer" : "Show all \(categories.count) categories")
              .domaFont(.supportingEmphasis)
              .foregroundStyle(DomaColor.warmNegativeText)
              .frame(minHeight: 44)
              .contentShape(.rect)
          }
          .buttonStyle(.plain)
        }
        Spacer(minLength: 8)
        Text("One-offs \(SpendingFormat.money(oneOffs))")
          .domaFont(.supporting)
          .monospacedDigit()
          .foregroundStyle(DomaColor.warmTextSecondary)
          .frame(minHeight: 44)
      }
    }
  }
}
