import ClerkKit
import SwiftUI

/// Sign-in only: `transferable: false` stops an unknown Google account from becoming a sign-up.
struct SignInView: View {
  @State private var isSigningIn = false
  @State private var errorMessage: String?

  var body: some View {
    VStack(spacing: 12) {
      Image(decorative: "HearthMark")
      Text("Doma")
        .domaFont(.display)
        .foregroundStyle(DomaColor.warmTextPrimary)
      Text("Sign in with an approved household account.")
        .domaFont(.supporting)
        .foregroundStyle(DomaColor.warmTextSecondary)
        .multilineTextAlignment(.center)
      Button {
        Task { await signIn() }
      } label: {
        Text(isSigningIn ? "Signing in..." : "Continue with Google")
          .frame(maxWidth: .infinity)
      }
      .domaPrimaryButton()
      .disabled(isSigningIn)
      .padding(.top, 16)
      if let errorMessage {
        Text(errorMessage)
          .domaFont(.supporting)
          .foregroundStyle(DomaColor.warmAccent)
          .multilineTextAlignment(.center)
      }
    }
    .padding(32)
    .frame(maxWidth: 480)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(DomaColor.warmBgCardSoft.ignoresSafeArea())
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
