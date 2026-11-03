import SwiftUI

struct LockedView: View {
  let lock: AppLockController

  var body: some View {
    ContentUnavailableView {
      Label("Doma is locked", systemImage: "lock")
    } actions: {
      Button("Unlock") {
        Task { await lock.unlock() }
      }
      .buttonStyle(.borderedProminent)
      .disabled(lock.isAuthenticating)
    }
  }
}
