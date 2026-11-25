import DomaKit
import SwiftUI

/// Chooses the months Spending shows: shortcut chips, the net strip and the month grid all edit
/// one draft choice, which applies on Done. A chip keeps its preset, so This FY stays This FY when
/// it happens to cover the same months as 3 mo; the strip and grid pick months.
struct SpendingRangeSheet: View {
  let months: [DomaSpendingMonthNet]
  let available: DomaMonthRange
  let onDone: (SpendingRangeChoice) -> Void
  @State private var choice: SpendingRangeChoice
  @Environment(\.dismiss) private var dismiss

  init(
    months: [DomaSpendingMonthNet], available: DomaMonthRange, initial: SpendingRangeChoice,
    onDone: @escaping (SpendingRangeChoice) -> Void
  ) {
    self.months = months
    self.available = available
    self.onDone = onDone
    _choice = State(initialValue: initial)
  }

  private var draft: DomaMonthRange { choice.range(within: available) ?? available }

  private var pickedMonths: Binding<DomaMonthRange> {
    Binding { draft } set: { choice = .picked($0) }
  }

  /// The same number of months just before the draft, as the server compares against once the
  /// draft is applied; the server reports none when those months have no data.
  private var comparisonLine: String {
    let count = draft.monthCount
    let before = SpendingFormat.monthCountLong(count)
    guard let comparison = DomaMonthRange(from: draft.from.adding(months: -count), to: draft.from.adding(months: -1)),
      months.contains(where: { comparison.contains($0.month) })
    else { return "\(before) · no earlier months to compare" }
    return "\(before) · compared with \(SpendingFormat.rangeTitle(comparison))"
  }

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 18) {
          VStack(alignment: .leading, spacing: 2) {
            Text(SpendingFormat.rangeTitle(draft))
              .domaFont(.displaySmall)
              .foregroundStyle(DomaColor.warmTextPrimary)
            Text(comparisonLine)
              .domaFont(.supporting)
              .foregroundStyle(DomaColor.warmTextSecondary)
          }
          .accessibilityElement(children: .combine)
          .padding(.horizontal, 4)
          chips
          VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
              Text("Net per month")
                .domaFont(.kicker)
                .tracking(1)
                .textCase(.uppercase)
                .foregroundStyle(DomaColor.warmTextSecondary)
              Spacer(minLength: 8)
              Text("Drag the ends")
                .domaFont(.detail)
                .foregroundStyle(DomaColor.warmTextTertiary)
            }
            .accessibilityHidden(true)
            SpendingRangeStrip(months: months, available: available, range: pickedMonths)
          }
          .padding(.horizontal, 16)
          .padding(.top, 14)
          .padding(.bottom, 12)
          .domaCardSurface()
          SpendingMonthGrid(available: available, range: pickedMonths)
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 16)
            .domaCardSurface()
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 24)
      }
      .background(DomaColor.sheetBackground.ignoresSafeArea())
      .navigationTitle("Time range")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Done") {
            onDone(choice)
            dismiss()
          }
        }
      }
    }
    .presentationDetents([.large])
  }

  private var chips: some View {
    return ScrollView(.horizontal) {
      HStack(spacing: 8) {
        ForEach(SpendingRangePreset.allCases) { preset in
          let presetRange = preset.range(within: available)
          let isSelected = choice == .preset(preset)
          Button {
            choice = .preset(preset)
          } label: {
            Text(preset.label)
              .domaFont(isSelected ? .supportingEmphasis : .supporting)
              .foregroundStyle(isSelected ? DomaColor.warmBgCard : DomaColor.warmTextPrimary)
              .padding(.horizontal, 14)
              .frame(minHeight: 36)
              .background(isSelected ? DomaColor.warmTextPrimary : DomaColor.warmBgCard, in: .capsule)
              .overlay { Capsule().strokeBorder(isSelected ? .clear : DomaColor.warmBorder) }
              .frame(minHeight: 44)
              .contentShape(.rect)
          }
          .buttonStyle(.plain)
          .disabled(presetRange == nil)
          .opacity(presetRange == nil ? 0.4 : 1)
          .accessibilityAddTraits(isSelected ? .isSelected : [])
        }
      }
      .padding(.horizontal, 4)
    }
    .scrollIndicators(.hidden)
    .padding(.horizontal, -16)
    .contentMargins(.horizontal, 16, for: .scrollContent)
  }
}
