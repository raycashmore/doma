import ClerkKit
import Combine
import Foundation
@preconcurrency import ConvexMobile
import DomaKit
import Observation
import OSLog
import WidgetKit

/// Keeps the Convex client's authentication in step with the Clerk session.
@Observable
final class DomaSession {
  enum Phase: Equatable {
    case loading
    case signedOut
    case signedIn

    /// Clerk reports a session change about once a minute, and each re-login passes through
    /// `.loading`. Staying signed in keeps the screens, and any edit in progress, alive through it.
    func next(after state: AuthState<String>, isClerkLoaded: Bool) -> Phase {
      switch state {
      case .authenticated: .signedIn
      case .unauthenticated: isClerkLoaded ? .signedOut : .loading
      case .loading: self == .signedIn ? .signedIn : .loading
      }
    }
  }

  private(set) var phase: Phase = .loading
  let lists: DomaListsClient
  /// A list a widget asked to open, kept here so signing out drops it.
  let openRequest = ListOpenRequest()

  @ObservationIgnored private let logger = Logger(subsystem: "com.doma.app", category: "session")
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
      options: .init(keychainConfig: configuration.clerkKeychain, redirectConfig: Self.clerkRedirect)
    )
    convex = ConvexClientWithAuth(deploymentUrl: configuration.convexURL, authProvider: DomaClerkConvexAuthProvider())
    lists = DomaListsClient(convex: convex)

    authStateSubscription = convex.authState
      .receive(on: DispatchQueue.main)
      .sink { [weak self] state in self?.apply(state) }
    sessionSync = Task { [weak self] in await self?.syncWithClerk() }
  }

  func signOut() async {
    LastOpenedList().forget()
    openRequest.publicId = nil
    await convex.logout()
    WidgetCenter.shared.reloadAllTimelines()
  }

  private func apply(_ state: AuthState<String>) {
    let next = phase.next(after: state, isClerkLoaded: Clerk.shared.isLoaded)
    if next != phase { logger.info("Phase \(String(describing: self.phase), privacy: .public) -> \(String(describing: next), privacy: .public)") }
    phase = next
  }

  private func syncWithClerk() async {
    while !Clerk.shared.isLoaded {
      try? await Task.sleep(for: .milliseconds(100))
      if Task.isCancelled { return }
    }
    #if DEBUG && targetEnvironment(simulator)
    if Clerk.shared.session == nil, let ticket = SimulatorLaunch.consumeSignInTicket() {
      _ = try? await Clerk.shared.auth.signInWithTicket(ticket)
    }
    #endif
    await authenticate(for: Clerk.shared.session)
    for await event in Clerk.shared.auth.events {
      if case .sessionChanged(_, let session) = event {
        logger.info("Clerk session changed")
        await authenticate(for: session)
      }
    }
  }

  private func authenticate(for session: Session?) async {
    if session?.status == .active {
      _ = await convex.loginFromCache()
    } else {
      // Here rather than on the signed-out phase, which also appears briefly during a normal launch.
      LastOpenedList().forget()
      openRequest.publicId = nil
      await convex.logout()
      phase = .signedOut
      // The widgets share this session, so they show the sign-out at once rather than old lists.
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
