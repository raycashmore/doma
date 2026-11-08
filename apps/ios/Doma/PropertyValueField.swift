import DomaKit
import SwiftUI

struct PropertyValueField: View {
  let property: DomaListProperty
  let isInvalid: Bool
  @Binding var value: PropertyDraft
  @ScaledMetric(relativeTo: .body) private var clearButtonSize = 44

  var body: some View {
    switch property.kind {
    case .text:
      LabeledContent {
        field(text: $value.text, lineLimit: 1...6, axis: .vertical)
      } label: {
        name
      }
    case .number:
      LabeledContent {
        field(text: $value.number, lineLimit: 1...1, axis: .horizontal)
          .keyboardType(.numbersAndPunctuation)
      } label: {
        name
        if isInvalid {
          Text("Enter a number")
            .domaFont(.supporting)
            .foregroundStyle(DomaColor.destructive)
        }
      }
    case .date:
      dateField
    case .select:
      Picker(selection: $value.optionId) {
        Text("None").tag(String?.none)
        ForEach(property.options ?? []) { option in
          Text(option.label).tag(String?.some(option.id))
        }
      } label: {
        name
      }
      .pickerStyle(.menu)
      .domaFont(.body)
      .tint(DomaColor.warmTextSecondary)
    case .checkbox:
      checkboxField
    }
  }

  private var name: some View {
    Text(property.name)
      .domaFont(.body)
      .foregroundStyle(DomaColor.warmTextPrimary)
  }

  private func field(text: Binding<String>, lineLimit: ClosedRange<Int>, axis: Axis) -> some View {
    TextField(
      property.name,
      text: text,
      prompt: Text("None").foregroundStyle(DomaColor.warmTextSecondary),
      axis: axis
    )
    .lineLimit(lineLimit)
    .multilineTextAlignment(.trailing)
    .domaFont(.body)
    .foregroundStyle(DomaColor.warmTextSecondary)
  }

  @ViewBuilder
  private var dateField: some View {
    if let date = value.date {
      HStack {
        DatePicker(
          selection: Binding(get: { date }, set: { value.date = PropertyValueFormat.noon(of: $0) }),
          displayedComponents: .date
        ) {
          name
        }
        .domaFont(.body)
        clearButton { value.date = nil }
      }
    } else {
      Button {
        value.date = PropertyValueFormat.noon(of: .now)
      } label: {
        LabeledContent {
          Text("Add Date")
            .domaFont(.body)
            .foregroundStyle(DomaColor.warmTextSecondary)
        } label: {
          name
        }
      }
      .accessibilityLabel("Add \(property.name)")
    }
  }

  private var checkboxField: some View {
    HStack {
      Toggle(
        isOn: Binding(get: { value.isChecked ?? false }, set: { value.isChecked = $0 })
      ) {
        name
        if value.isChecked == nil {
          Text("Not set")
            .domaFont(.supporting)
            .foregroundStyle(DomaColor.warmTextSecondary)
        }
      }
      .tint(DomaColor.warmAccent)
      if value.isChecked != nil {
        clearButton { value.isChecked = nil }
      }
    }
  }

  private func clearButton(action: @escaping () -> Void) -> some View {
    Button("Clear \(property.name)", systemImage: "xmark.circle.fill", action: action)
      .labelStyle(.iconOnly)
      .buttonStyle(.borderless)
      .foregroundStyle(DomaColor.warmTextSecondary)
      .frame(width: clearButtonSize, height: clearButtonSize)
      .contentShape(.rect)
  }
}
