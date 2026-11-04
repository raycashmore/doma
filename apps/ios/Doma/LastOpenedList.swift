import Foundation

/// Remembers which list to reopen on launch, so iPhone starts on that list with Lists behind it.
struct LastOpenedList {
  private static let key = "lastOpenedListPublicId"

  var defaults = UserDefaults.standard

  var publicId: String? {
    defaults.string(forKey: Self.key)
  }

  func remember(_ publicId: String) {
    defaults.set(publicId, forKey: Self.key)
  }

  func forget() {
    defaults.removeObject(forKey: Self.key)
  }

  /// The remembered list, unless it has been deleted or shared access has ended since it was opened.
  func restorableId(among visibleIds: some Sequence<String>) -> String? {
    guard let publicId, visibleIds.contains(publicId) else { return nil }
    return publicId
  }
}
