import Foundation
import Security

/// Holds this device's login in the keychain group the app and the widget share.
///
/// `AfterFirstUnlockThisDeviceOnly`: the widget can read it while the device is locked, and it never
/// goes to backups, iCloud Keychain or a new device. Never log what this reads.
public struct DomaDeviceKeychain: Sendable {
  public struct Credential: Codable, Equatable, Sendable {
    public let deviceId: String
    public let secret: String

    public init(deviceId: String, secret: String) {
      self.deviceId = deviceId
      self.secret = secret
    }
  }

  public enum Failure: Error, Equatable {
    /// The keychain is locked (before the first unlock after a restart) or failed. Not a sign-out.
    case unavailable(status: OSStatus)
  }

  public let service: String
  private let accessGroup: String?
  private static let account = "device-login"

  public init(service: String = "com.doma.app.device-login", accessGroup: String?) {
    self.service = service
    self.accessGroup = accessGroup
  }

  private func query() -> [String: Any] {
    var query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: Self.account,
      kSecAttrSynchronizable as String: false,
      kSecUseDataProtectionKeychain as String: true,
    ]
    if let accessGroup { query[kSecAttrAccessGroup as String] = accessGroup }
    return query
  }

  /// The stored login, or nil when this device has none.
  public func read() throws(Failure) -> Credential? {
    var request = query()
    request[kSecReturnData as String] = true
    request[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    let status = SecItemCopyMatching(request as CFDictionary, &result)
    if status == errSecItemNotFound { return nil }
    guard status == errSecSuccess, let data = result as? Data else { throw .unavailable(status: status) }
    // An unreadable item is treated as no login, so the device signs in again rather than sticking.
    return try? JSONDecoder().decode(Credential.self, from: data)
  }

  public func save(_ credential: Credential) throws(Failure) {
    let data: Data
    do {
      data = try JSONEncoder().encode(credential)
    } catch {
      throw .unavailable(status: errSecParam)
    }
    SecItemDelete(query() as CFDictionary)
    var item = query()
    item[kSecValueData as String] = data
    item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    let status = SecItemAdd(item as CFDictionary, nil)
    guard status == errSecSuccess else { throw .unavailable(status: status) }
  }

  public func delete() {
    SecItemDelete(query() as CFDictionary)
  }
}
