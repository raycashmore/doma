import ClerkKit
import Combine
import Foundation
@preconcurrency import ConvexMobile
import DomaKit
import Observation

/// Keeps the Convex client's authentication in step with the Clerk session.
@Observable
final class DomaSession {
  enum Phase: Equatable {
    case loading
    case signedOut
    case signedIn
  }

  private(set) var phase: Phase = .loading
  let lists: DomaListsClient

  @ObservationIgnored private let convex: ConvexClientWithAuth<String>
  @ObservationIgnored private var authStateSubscription: AnyCancellable?
  @ObservationIgnored private var sessionSync: Task<Void, Never>?

  /// The redirect each Clerk instance allowlists. Fixed, so a build with an overridden
  /// bundle identifier (free provisioning) still matches the allowlisted URL.
  private static let clerkRedirect = Clerk.Options.RedirectConfig(
    redirectUrl: "com.doma.app://callback",
    callbackUrlScheme: "com.doma.app"
  )

  init(configuration: DomaConfiguration) {
    Clerk.configure(
      publishableKey: configuration.clerkPublishableKey,
      options: .init(redirectConfig: Self.clerkRedirect)
    )
    convex = ConvexClientWithAuth(deploymentUrl: configuration.convexURL, authProvider: DomaClerkConvexAuthProvider())
    lists = DomaListsClient(convex: convex)

    authStateSubscription = convex.authState
      .receive(on: DispatchQueue.main)
      .sink { [weak self] state in self?.apply(state) }
    sessionSync = Task { [weak self] in await self?.syncWithClerk() }
  }

  func signOut() async {
    await convex.logout()
  }

  private func apply(_ state: AuthState<String>) {
    switch state {
    case .authenticated: phase = .signedIn
    case .unauthenticated: phase = Clerk.shared.isLoaded ? .signedOut : .loading
    case .loading: phase = .loading
    }
  }

  private func syncWithClerk() async {
    while !Clerk.shared.isLoaded {
      try? await Task.sleep(for: .milliseconds(100))
      if Task.isCancelled { return }
    }
    await authenticate(for: Clerk.shared.session)
    for await event in Clerk.shared.auth.events {
      if case .sessionChanged(_, let session) = event {
        await authenticate(for: session)
      }
    }
  }

  private func authenticate(for session: Session?) async {
    if session?.status == .active {
      _ = await convex.loginFromCache()
    } else {
      await convex.logout()
      phase = .signedOut
    }
  }
}
