import SwiftUI

/// App settings. For now it only signs out; Paprika lives in Lists.
struct SettingsSheet: View {
  let session: DomaSession
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    NavigationStack {
      List {
        Button(role: .destructive) {
          Task { await session.signOut() }
        } label: {
          Text("Sign out").domaFont(.body)
        }
      }
      .domaScreenBackground()
      .navigationTitle("Settings")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          Button("Done") { dismiss() }
        }
      }
    }
    .tint(DomaColor.warmTextPrimary)
  }
}
