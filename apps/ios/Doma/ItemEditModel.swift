import DomaKit
import Foundation

/// The editable form of one property value. Only the field matching the property's kind is used.
struct PropertyDraft: Equatable {
  var text = ""
  var number = ""
  var date: Date?
  var optionId: String?
  /// Stays `nil` until set: not set, checked and unchecked are three different states.
  var isChecked: Bool?

  init() {}

  init(property: DomaListProperty, value: DomaListItemPropertyValue?) {
    guard let value else { return }
    switch property.kind {
    case .text:
      text = value.textValue ?? ""
    case .number:
      number = value.numberValue.map { PropertyValueFormat.number($0) } ?? ""
    case .date:
      date = value.date.map { PropertyValueFormat.noon(of: $0) }
    case .select:
      optionId = property.options?.first { $0.id == value.selectOptionId }?.id
    case .checkbox:
      isChecked = value.checkboxValue
    }
  }

  fileprivate func isInvalid(for property: DomaListProperty) -> Bool {
    property.kind == .number && !trimmedNumber.isEmpty && PropertyValueFormat.parseNumber(trimmedNumber) == nil
  }

  fileprivate func isSame(as other: PropertyDraft, for property: DomaListProperty) -> Bool {
    switch property.kind {
    case .text: trimmedText == other.trimmedText
    case .number: isSameNumber(as: other)
    case .date: date == other.date
    // An option removed elsewhere is left out of the save, as a removed property is.
    case .select: optionId == other.optionId || (optionId != nil && !isLiveOption(of: property))
    case .checkbox: isChecked == other.isChecked
    }
  }

  /// The value to save, or `nil` when the draft is empty and the stored value should be cleared.
  fileprivate func value(for property: DomaListProperty) -> DomaListPropertyValue? {
    switch property.kind {
    case .text: trimmedText.isEmpty ? nil : .text(trimmedText)
    case .number: PropertyValueFormat.parseNumber(trimmedNumber).map { .number($0) }
    case .date: date.map { .date($0) }
    case .select: optionId.map { .select(optionId: $0) }
    case .checkbox: isChecked.map { .checkbox($0) }
    }
  }

  private func isSameNumber(as other: PropertyDraft) -> Bool {
    if let number = PropertyValueFormat.parseNumber(trimmedNumber),
      let otherNumber = PropertyValueFormat.parseNumber(other.trimmedNumber)
    {
      return number == otherNumber
    }
    return trimmedNumber == other.trimmedNumber
  }

  private func isLiveOption(of property: DomaListProperty) -> Bool {
    property.options?.contains { $0.id == optionId } ?? false
  }

  private var trimmedText: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }
  private var trimmedNumber: String { number.trimmingCharacters(in: .whitespaces) }
}

/// One server write. Each maps to a single Convex mutation.
enum ItemChange: Equatable {
  case title(String)
  case notes(String)
  case setValue(propertyId: DomaListProperty.ID, DomaListPropertyValue)
  case clearValue(propertyId: DomaListProperty.ID)
  case completion(Bool)
}

struct ItemEditFields: Equatable {
  var title: String
  var notes: String
  var isCompleted: Bool
  var values: [DomaListProperty.ID: PropertyDraft]

  init(item: DomaListItem, properties: [DomaListProperty], isCompleted: Bool) {
    title = item.title
    notes = item.notes ?? ""
    self.isCompleted = isCompleted
    values = Dictionary(
      uniqueKeysWithValues: properties.map { property in
        let value = item.propertyValues.first { $0.propertyId == property.id }
        return (property.id, PropertyDraft(property: property, value: value))
      })
  }

  fileprivate var trimmedTitle: String { title.trimmingCharacters(in: .whitespacesAndNewlines) }
  fileprivate var trimmedNotes: String { notes.trimmingCharacters(in: .whitespacesAndNewlines) }
}

/// Holds an item's edits until Save. Only fields changed here are written, so a household member's
/// edit to another field survives. `saved` advances per write, so a retry sends only what remains.
@MainActor
@Observable
final class ItemEditModel {
  var draft: ItemEditFields
  private(set) var saved: ItemEditFields
  private(set) var isSaving = false

  init(item: DomaListItem, properties: [DomaListProperty], isCompleted: Bool) {
    let fields = ItemEditFields(item: item, properties: properties, isCompleted: isCompleted)
    draft = fields
    saved = fields
  }

  /// Properties are the live list, so one removed elsewhere while editing is left out.
  func changes(properties: [DomaListProperty]) -> [ItemChange] {
    var changes: [ItemChange] = []
    if draft.trimmedTitle != saved.trimmedTitle { changes.append(.title(draft.trimmedTitle)) }
    if draft.trimmedNotes != saved.trimmedNotes { changes.append(.notes(draft.trimmedNotes)) }
    for property in properties {
      let edited = draft.values[property.id] ?? PropertyDraft()
      let stored = saved.values[property.id] ?? PropertyDraft()
      guard !edited.isSame(as: stored, for: property) else { continue }
      if let value = edited.value(for: property) {
        changes.append(.setValue(propertyId: property.id, value))
      } else {
        changes.append(.clearValue(propertyId: property.id))
      }
    }
    if draft.isCompleted != saved.isCompleted { changes.append(.completion(draft.isCompleted)) }
    return changes
  }

  func canSave(properties: [DomaListProperty]) -> Bool {
    !isSaving && !draft.trimmedTitle.isEmpty && !hasInvalidValue(properties: properties)
      && !changes(properties: properties).isEmpty
  }

  func isInvalid(_ property: DomaListProperty) -> Bool {
    draft.values[property.id]?.isInvalid(for: property) ?? false
  }

  /// Stops at the first failure and rethrows it, leaving the unsaved changes pending.
  func save(properties: [DomaListProperty], using apply: (ItemChange) async throws -> Void) async throws {
    guard canSave(properties: properties) else { return }
    isSaving = true
    defer { isSaving = false }
    for change in changes(properties: properties) {
      try await apply(change)
      record(change)
    }
  }

  private func hasInvalidValue(properties: [DomaListProperty]) -> Bool {
    properties.contains(where: isInvalid)
  }

  private func record(_ change: ItemChange) {
    switch change {
    case .title: saved.title = draft.title
    case .notes: saved.notes = draft.notes
    case .setValue(let propertyId, _), .clearValue(let propertyId):
      saved.values[propertyId] = draft.values[propertyId]
    case .completion: saved.isCompleted = draft.isCompleted
    }
  }
}

extension DomaListsClient {
  func apply(_ change: ItemChange, toItem itemId: DomaListItem.ID) async throws {
    switch change {
    case .title(let title):
      try await renameItem(itemId: itemId, title: title)
    case .notes(let notes):
      try await setItemNotes(itemId: itemId, notes: notes)
    case .setValue(let propertyId, let value):
      try await setItemPropertyValue(itemId: itemId, propertyId: propertyId, value: value)
    case .clearValue(let propertyId):
      try await clearItemPropertyValue(itemId: itemId, propertyId: propertyId)
    case .completion(true):
      try await complete(itemId: itemId)
    case .completion(false):
      try await uncomplete(itemId: itemId)
    }
  }
}
