import DomaKit
import Foundation

struct ListItemGroup: Equatable, Identifiable {
  let id: String
  let label: String
  let isUnassigned: Bool
  let items: [DomaListItem]
}

/// A port of the web's `grouping.ts`. `ListItemGroupingTests` repeats its cases, so keep the two in step.
/// Items arrive in manual order, which each group keeps. Missing values go to a final Unassigned group,
/// so no item is hidden by grouping.
enum ListItemGrouping {
  static func groups(
    of items: [DomaListItem], by property: DomaListProperty, calendar: Calendar = .current
  ) -> [ListItemGroup] {
    var assigned: [ListItemGroup]
    var unassigned: [DomaListItem] = []

    func value(of item: DomaListItem) -> DomaListItemPropertyValue? {
      item.propertyValues.first { $0.propertyId == property.id }
    }

    switch property.kind {
    case .text:
      var buckets = Buckets<String>()
      for item in items {
        guard let text = value(of: item)?.textValue?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty
        else {
          unassigned.append(item)
          continue
        }
        // The first spelling seen labels the group, as on the web.
        buckets.add(item, key: text.lowercased(), label: text)
      }
      assigned = buckets.sorted { $0.localizedCompare($1) == .orderedAscending }
        .map { ListItemGroup(id: "text:\($0.key)", label: $0.label, isUnassigned: false, items: $0.items) }

    case .number:
      var buckets = Buckets<Double>()
      for item in items {
        guard let number = value(of: item)?.numberValue else {
          unassigned.append(item)
          continue
        }
        buckets.add(item, key: number, label: PropertyValueFormat.number(number))
      }
      assigned = buckets.sorted(by: <)
        .map { ListItemGroup(id: "number:\($0.key)", label: $0.label, isUnassigned: false, items: $0.items) }

    case .date:
      var buckets = Buckets<String>()
      for item in items {
        guard let date = value(of: item)?.date else {
          unassigned.append(item)
          continue
        }
        let day = calendar.dateComponents([.year, .month, .day], from: date)
        let key = String(format: "%04d-%02d-%02d", day.year ?? 0, day.month ?? 0, day.day ?? 0)
        buckets.add(item, key: key, label: PropertyValueFormat.date(date, calendar: calendar))
      }
      assigned = buckets.sorted(by: <)
        .map { ListItemGroup(id: "date:\($0.key)", label: $0.label, isUnassigned: false, items: $0.items) }

    case .checkbox:
      let yes = items.filter { value(of: $0)?.checkboxValue == true }
      let no = items.filter { value(of: $0)?.checkboxValue == false }
      unassigned = items.filter { value(of: $0)?.checkboxValue == nil }
      assigned = [
        ListItemGroup(id: "checkbox:true", label: "Yes", isUnassigned: false, items: yes),
        ListItemGroup(id: "checkbox:false", label: "No", isUnassigned: false, items: no),
      ].filter { !$0.items.isEmpty }

    case .select:
      let options = property.options ?? []
      let optionIds = Set(options.map(\.id))
      var itemsByOption: [String: [DomaListItem]] = [:]
      for item in items {
        // A value pointing at a removed option counts as Unassigned.
        if let optionId = value(of: item)?.selectOptionId, optionIds.contains(optionId) {
          itemsByOption[optionId, default: []].append(item)
        } else {
          unassigned.append(item)
        }
      }
      assigned = options.compactMap { option in
        itemsByOption[option.id].map {
          ListItemGroup(id: "select:\(option.id)", label: option.label, isUnassigned: false, items: $0)
        }
      }
    }

    if !unassigned.isEmpty {
      assigned.append(ListItemGroup(id: "unassigned", label: "Unassigned", isUnassigned: true, items: unassigned))
    }
    return assigned
  }
}

/// Items bucketed by key, keeping each bucket's first label and its items' order.
private struct Buckets<Key: Hashable> {
  struct Bucket {
    let key: Key
    let label: String
    var items: [DomaListItem]
  }

  private var buckets: [Key: Bucket] = [:]

  mutating func add(_ item: DomaListItem, key: Key, label: String) {
    buckets[key, default: Bucket(key: key, label: label, items: [])].items.append(item)
  }

  func sorted(by areInIncreasingOrder: (Key, Key) -> Bool) -> [Bucket] {
    buckets.values.sorted { areInIncreasingOrder($0.key, $1.key) }
  }
}
