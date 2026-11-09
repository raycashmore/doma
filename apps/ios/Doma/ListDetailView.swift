import DomaKit
import SwiftUI

struct ListDetailView: View {
  let lists: DomaListsClient
  let list: DomaListSummary
  let items: DomaListItems?
  /// The signed-in person's saved grouping; `nil` is manual order.
  let savedGroupingId: String?
  let isUnavailable: Bool
  let isDefault: Bool
  let onDelete: () async -> Void
  /// A choice still saving, shown in place of the saved one so the menu does not flick back.
  @State private var pendingGroupingId: String??
  /// The latest grouping save. Each save waits for the one before, so quick picks arrive in order.
  @State private var groupingSave: Task<Void, Never>?
  @State private var groupingSaveFailed = false
  @State private var isCategorising = false
  @State private var categorisationProblem: String?
  @Environment(\.isSplitLayout) private var isSplitLayout

  private var groupingId: String? { pendingGroupingId ?? savedGroupingId }

  var body: some View {
    Group {
      if let items {
        ListItemsView(
          lists: lists,
          items: items,
          // A deleted property groups nothing, so the list falls back to manual order.
          groupingProperty: items.properties.first { $0.id == groupingId },
          isCategorising: isCategorising
        )
      } else if isUnavailable {
        DomaStateView(title: "This list is unavailable", systemImage: "lock")
      } else {
        DomaLoadingView()
      }
    }
    .domaHeaderedSheet(title: title, corners: isSplitLayout ? .topLeading : .top)
    .navigationTitle(list.name)
    .toolbar {
      ListActionsMenu(lists: lists, list: list, isDefault: isDefault, onDelete: onDelete) {
        if let items, !items.properties.isEmpty {
          GroupByMenu(
            properties: items.properties,
            // A deleted property ticks Manual Order, which is how the list shows.
            groupingPropertyId: Binding(
              get: { items.properties.contains { $0.id == groupingId } ? groupingId : nil },
              set: { saveGrouping($0) }
            ),
            unassignedCount: unassignedCount(in: items),
            isCategorising: isCategorising,
            onCategorise: { Task { await categorise(into: categorisationProperty(in: items)) } }
          )
        }
      }
    }
    .onChange(of: savedGroupingId) { clearPendingGroupingOnceSaved() }
    .domaSaveFailureAlert(isPresented: $groupingSaveFailed)
    .alert(
      "Items were not categorised",
      isPresented: Binding(get: { categorisationProblem != nil }, set: { if !$0 { categorisationProblem = nil } })
    ) {
      Button("OK", role: .cancel) {}
    } message: {
      Text(categorisationProblem ?? "")
    }
  }

  /// Shared lists carry the people symbol after their name, as on the web.
  private var title: Text {
    list.visibility == .shared
      ? Text("\(list.name) \(sharedSymbol)").accessibilityLabel("\(list.name), shared")
      : Text(list.name)
  }

  /// Quieter than the name, as on the web.
  private var sharedSymbol: Text {
    Text(Image(systemName: "person.2")).font(.title3).foregroundStyle(DomaColor.warmTextOnDark.opacity(0.6))
  }

  /// The select property the server categorises into, set up on the web.
  private func categorisationProperty(in items: DomaListItems) -> DomaListProperty? {
    items.properties.first { property in
      property.kind == .select && property.categorisationInstruction?.isEmpty == false
        && property.options?.isEmpty == false
    }
  }

  private func unassignedCount(in items: DomaListItems) -> Int? {
    guard let property = categorisationProperty(in: items) else { return nil }
    return items.activeItems.count { item in !item.propertyValues.contains { $0.propertyId == property.id } }
  }

  private func saveGrouping(_ propertyId: String?) {
    pendingGroupingId = .some(propertyId)
    let previous = groupingSave
    groupingSave = Task {
      await previous?.value
      do {
        try await lists.setGroupingProperty(listPublicId: list.publicId, propertyId: propertyId)
        clearPendingGroupingOnceSaved()
      } catch {
        // Shows the saved choice again, unless a later pick is still waiting.
        if pendingGroupingId == .some(propertyId) { pendingGroupingId = nil }
        groupingSaveFailed = true
      }
    }
  }

  /// Keeps the pick on screen until the live subscription confirms it, so the list does not flick back.
  private func clearPendingGroupingOnceSaved() {
    if pendingGroupingId == .some(savedGroupingId) { pendingGroupingId = nil }
  }

  /// Groups by the categorised property once items land in it, as the web does.
  private func categorise(into property: DomaListProperty?) async {
    guard let property, !isCategorising else { return }
    isCategorising = true
    defer { isCategorising = false }
    do {
      switch try await lists.autoCategoriseUnassigned(listPublicId: list.publicId) {
      case .applied(let count) where count > 0: saveGrouping(property.id)
      case .applied, .idle: break
      case .skipped(reason: "missing_configuration"):
        categorisationProblem = "Set up AI categorisation for this list on the web first."
      case .skipped: categorisationProblem = "The AI gave an answer that could not be used. Try again."
      case .failed(reason: "provider_out_of_credits"):
        categorisationProblem = "The AI account has run out of credits. Add credits to OpenAI, then try again."
      case .failed: categorisationProblem = "The AI could not be reached. Try again later."
      }
    } catch {
      categorisationProblem = "Categorisation could not start. Check the connection and try again."
    }
  }
}
