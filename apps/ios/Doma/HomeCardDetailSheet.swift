import DomaKit
import SwiftUI

/// Everything a card holds, with Archive (and Edit for a note).
struct HomeCardDetailSheet: View {
  let item: DomaBoardItem
  let presentation: HomeBoardPresentation
  let home: DomaHomeClient
  let onEdit: (DomaBoardNote) -> Void
  @Environment(\.dismiss) private var dismiss
  @State private var isConfirmingArchive = false
  @State private var isArchiving = false
  @State private var archiveFailed = false
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 20) {
          heading
          details
          actions
        }
        .padding(20)
        .frame(maxWidth: 640, alignment: .leading)
        .frame(maxWidth: .infinity)
      }
      .domaScreenBackground()
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          Button("Done") { dismiss() }
            .disabled(isArchiving)
        }
      }
    }
    .tint(DomaColor.warmTextPrimary)
    .confirmationDialog(
      "Archive this card?", isPresented: $isConfirmingArchive, titleVisibility: .visible
    ) {
      Button("Archive", role: .destructive) { archive() }
    } message: {
      Text("It leaves the noticeboard for everyone in the household.")
    }
    .domaSaveFailureAlert(isPresented: $archiveFailed)
  }

  private var heading: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(presentation.kicker(for: item))
        .domaFont(.kicker)
        .tracking(1)
        .textCase(.uppercase)
        .foregroundStyle(presentation.isUrgent(item) ? DomaColor.warmAccent : DomaColor.warmTextSecondary)
      Text(title)
        .domaFont(.displaySmall)
        .foregroundStyle(DomaColor.warmTextPrimary)
        .accessibilityAddTraits(.isHeader)
      if let lead {
        Text(lead)
          .domaFont(.body)
          .foregroundStyle(DomaColor.warmTextSecondary)
      }
    }
  }

  private var title: String {
    switch item {
    case .today(let today): today.headline
    case .meals: "Today's meals"
    case .note(let note): note.title
    case .emailNotice(let notice): notice.title
    case .spendingInsight(let insight): presentation.spendingTitle(insight)
    }
  }

  private var lead: String? {
    switch item {
    case .today, .meals: nil
    case .note(let note): note.detail
    case .emailNotice(let notice): notice.detail
    case .spendingInsight(let insight): insight.title
    }
  }

  @ViewBuilder
  private var details: some View {
    switch item {
    case .today(let today):
      let lines = presentation.todayLines(today)
      if lines.isEmpty {
        Text("Nothing needs attention in the morning briefing.")
          .domaFont(.body)
          .foregroundStyle(DomaColor.warmTextSecondary)
      } else {
        facts(lines.map { ($0.label, $0.text) })
      }
    case .meals(let meals):
      facts([("School lunch", meals.schoolLunch ?? "Not planned"), ("Dinner", meals.dinner ?? "Not planned")])
    case .note(let note):
      if let due = note.dueDate.flatMap(presentation.longDate) { facts([("Due", due)]) }
    case .emailNotice(let notice):
      facts(
        (notice.dueDate.flatMap(presentation.longDate).map { [("Due", $0)] } ?? [])
          + notice.facts.map { ($0.label, $0.value) }
          + [("Received", presentation.receivedAt(notice))])
    case .spendingInsight(let insight):
      Text(insight.detail)
        .domaFont(.body)
        .foregroundStyle(DomaColor.warmTextPrimary)
    }
  }

  private func facts(_ rows: [(String, String)]) -> some View {
    VStack(spacing: 0) {
      ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
        if index > 0 { Divider().overlay(DomaColor.warmBorder) }
        // At accessibility text sizes the label sits above its value.
        let layout = dynamicTypeSize.isAccessibilitySize
          ? AnyLayout(VStackLayout(alignment: .leading, spacing: 2))
          : AnyLayout(HStackLayout(alignment: .firstTextBaseline, spacing: 16))
        layout {
          Text(row.0)
            .domaFont(.supporting)
            .foregroundStyle(DomaColor.warmTextSecondary)
          if !dynamicTypeSize.isAccessibilitySize { Spacer(minLength: 0) }
          Text(row.1)
            .domaFont(.supporting)
            .foregroundStyle(DomaColor.warmTextPrimary)
            .multilineTextAlignment(dynamicTypeSize.isAccessibilitySize ? .leading : .trailing)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 12)
        .accessibilityElement(children: .combine)
      }
    }
    .padding(.horizontal, 16)
    .background(DomaColor.warmBgCard, in: .rect(cornerRadius: 16))
    .overlay { RoundedRectangle(cornerRadius: 16).strokeBorder(DomaColor.warmBorder) }
  }

  private var actions: some View {
    VStack(spacing: 10) {
      if case .note(let note) = item {
        Button { onEdit(note) } label: { actionLabel("Edit note") }
      }
      Button { isConfirmingArchive = true } label: { actionLabel(isArchiving ? "Archiving…" : "Archive") }
        .disabled(isArchiving)
    }
    .buttonStyle(.plain)
    .padding(.top, 4)
  }

  private func actionLabel(_ text: String) -> some View {
    Text(text)
      .domaFont(.button)
      .foregroundStyle(DomaColor.warmTextPrimary)
      .frame(maxWidth: .infinity, minHeight: 50)
      .background(DomaColor.warmBgCard, in: .capsule)
      .overlay { Capsule().strokeBorder(DomaColor.warmBorder) }
      .contentShape(.capsule)
  }

  private func archive() {
    isArchiving = true
    Task {
      do {
        try await home.archive(item)
        dismiss()
      } catch {
        isArchiving = false
        archiveFailed = true
      }
    }
  }
}
