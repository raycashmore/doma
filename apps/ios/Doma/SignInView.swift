import ClerkKit
import SwiftUI

/// Sign-in only: `transferable: false` stops an unknown Google account from becoming a sign-up.
struct SignInView: View {
  @State private var isSigningIn = false
  @State private var errorMessage: String?

  var body: some View {
    VStack(spacing: 24) {
      Spacer()
      VStack(spacing: 8) {
        Text("Doma")
          .font(.largeTitle.bold())
        Text("Sign in with an approved household account.")
          .foregroundStyle(.secondary)
          .multilineTextAlignment(.center)
      }
      Button {
        Task { await signIn() }
      } label: {
        Label("Continue with Google", systemImage: "person.crop.circle")
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(.borderedProminent)
      .controlSize(.large)
      .disabled(isSigningIn)
      if let errorMessage {
        Text(errorMessage)
          .font(.footnote)
          .foregroundStyle(.red)
          .multilineTextAlignment(.center)
      }
      Spacer()
    }
    .padding(32)
    .frame(maxWidth: 480)
  }

  private func signIn() async {
    isSigningIn = true
    errorMessage = nil
    defer { isSigningIn = false }
    do {
      try await Clerk.shared.auth.signInWithOAuth(provider: .google, transferable: false)
    } catch {
      errorMessage = "Sign-in did not complete. Only approved accounts can sign in."
    }
  }
}
