import DomaKit
import SwiftUI

/// One noticeboard card: a short, fixed amount of each item, with the rest in its detail sheet.
struct HomeCard: View {
  let item: DomaBoardItem
  let presentation: HomeBoardPresentation
  @ScaledMetric(relativeTo: .subheadline) private var labelWidth: CGFloat = 88
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  /// At accessibility text sizes a label sits above its value, so neither is squeezed.
  private var stacksLabels: Bool { dynamicTypeSize.isAccessibilitySize }

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .firstTextBaseline) {
        Text(presentation.kicker(for: item))
          .domaFont(.kicker)
          .tracking(1)
          .textCase(.uppercase)
          .foregroundStyle(presentation.isUrgent(item) ? DomaColor.warmAccent : DomaColor.warmTextSecondary)
        Spacer(minLength: 8)
        Image(systemName: "chevron.right")
          .domaFont(.detail)
          .foregroundStyle(DomaColor.warmTextTertiary)
          .accessibilityHidden(true)
      }
      content
    }
    .padding(16)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(DomaColor.warmBgCard, in: .rect(cornerRadius: 16))
    .overlay { RoundedRectangle(cornerRadius: 16).strokeBorder(DomaColor.warmBorder) }
    .contentShape(.rect(cornerRadius: 16))
  }

  @ViewBuilder
  private var content: some View {
    switch item {
    case .today(let today): todayContent(today)
    case .meals(let meals):
      VStack(alignment: .leading, spacing: 4) {
        labelled("School lunch", meals.schoolLunch ?? "Not planned")
        labelled("Dinner", meals.dinner ?? "Not planned")
      }
    case .note(let note): titled(note.title, note.detail)
    case .emailNotice(let notice): titled(notice.title, notice.detail)
    case .spendingInsight(let insight): titled(presentation.spendingTitle(insight), insight.title)
    }
  }

  private func todayContent(_ today: DomaBoardToday) -> some View {
    let lines = presentation.todayLines(today)
    let shown = lines.prefix(HomeBoardPresentation.todayPreviewCount)
    return VStack(alignment: .leading, spacing: 8) {
      Text(today.headline)
        .domaFont(.cardHeadline)
        .foregroundStyle(DomaColor.warmTextPrimary)
        .lineLimit(2)
      VStack(alignment: .leading, spacing: 4) {
        ForEach(shown) { line in labelled(line.label, line.text) }
        if lines.count > shown.count {
          Text("\(lines.count - shown.count) more today")
            .domaFont(.supporting)
            .fontWeight(.semibold)
            .foregroundStyle(DomaColor.warmTextSecondary)
            .padding(.leading, stacksLabels ? 0 : labelWidth + 10)
        }
      }
    }
  }

  private func titled(_ title: String, _ detail: String?) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(title)
        .domaFont(.displayInline)
        .foregroundStyle(DomaColor.warmTextPrimary)
        .lineLimit(2)
      if let detail, !detail.isEmpty {
        Text(detail)
          .domaFont(.supporting)
          .foregroundStyle(DomaColor.warmTextSecondary)
          .lineLimit(2)
      }
    }
  }

  private func labelled(_ label: String, _ value: String) -> some View {
    let layout = stacksLabels
      ? AnyLayout(VStackLayout(alignment: .leading, spacing: 0))
      : AnyLayout(HStackLayout(alignment: .firstTextBaseline, spacing: 10))
    return layout {
      Text(label)
        .domaFont(.supporting)
        .foregroundStyle(DomaColor.warmTextSecondary)
        .frame(width: stacksLabels ? nil : labelWidth, alignment: .leading)
      Text(value)
        .domaFont(.supporting)
        .foregroundStyle(DomaColor.warmTextPrimary)
        .lineLimit(stacksLabels ? 2 : 1)
    }
  }
}
