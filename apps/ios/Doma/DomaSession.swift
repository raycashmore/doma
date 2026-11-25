import ClerkKit
import Foundation
@preconcurrency import ConvexMobile
import DomaKit
import Observation
import OSLog
import UIKit
import WidgetKit

/// Keeps the Convex client signed in with this device's Doma login.
///
/// Clerk is used only to sign in and link the device (`DomaDeviceLogin`). After that the app follows
/// the device login, not the Clerk session, so it stays signed in past Clerk's 7-day limit. Only the
/// server's rejection of the device login (seen here or by the widget), or Sign out, ends it; a
/// network failure never does.
@Observable
final class DomaSession {
  enum Phase: Equatable {
    case loading
    case signedOut
    case signedIn
  }

  private(set) var phase: Phase = .loading
  let lists: DomaListsClient
  let home: DomaHomeClient
  let paprika: DomaPaprikaClient
  let spending: DomaSpendingClient
  /// A list a widget asked to open, kept here so signing out drops it.
  let openRequest = ListOpenRequest()
  /// A noticeboard card the Home widget asked to open.
  let homeOpenRequest = HomeOpenRequest()

  @ObservationIgnored private let logger = Logger(subsystem: "com.doma.app", category: "session")
  @ObservationIgnored private let convex: ConvexClientWithAuth<String>
  @ObservationIgnored private let deviceLogin: DomaDeviceLogin
  @ObservationIgnored private var sessionSync: Task<Void, Never>?

  /// The redirect each Clerk instance allowlists. Fixed, so a build with an overridden
  /// bundle identifier (free provisioning) still matches the allowlisted URL.
  private static let clerkRedirect = Clerk.Options.RedirectConfig(
    redirectUrl: "com.doma.app://callback",
    callbackUrlScheme: "com.doma.app"
  )

  init?(configuration: DomaConfiguration) {
    guard let transport = DomaDeviceLogin.Transport.convex(deploymentURL: configuration.convexURL) else { return nil }
    Clerk.configure(
      publishableKey: configuration.clerkPublishableKey,
      options: .init(keychainConfig: configuration.clerkKeychain, redirectConfig: Self.clerkRedirect)
    )
    let deviceLogin = DomaDeviceLogin(keychain: configuration.deviceKeychain, transport: transport)
    let ending = DeviceLoginEnding()
    self.deviceLogin = deviceLogin
    convex = ConvexClientWithAuth(
      deploymentUrl: configuration.convexURL,
      // Not awaited: the end can arrive inside ConvexMobile's token refresh, which
      // `convex.logout()` would otherwise wait on.
      authProvider: DomaDeviceConvexAuthProvider(deviceLogin: deviceLogin) { Task { await ending.notify() } }
    )
    lists = DomaListsClient(convex: convex)
    home = DomaHomeClient(convex: convex)
    paprika = DomaPaprikaClient(convex: convex)
    spending = DomaSpendingClient(convex: convex)
    ending.handler = { [weak self] in await self?.endDeviceLogin() }
    sessionSync = Task { [weak self] in await self?.start() }
  }

  /// Revokes this device on the server, as far as the network allows, and signs it out here.
  func signOut() async {
    await deviceLogin.signOut()
    await endDeviceLogin()
  }

  private func start() async {
    // A locked keychain counts as linked: linking again would make a second device login.
    let isLinked: Bool
    do { isLinked = try await deviceLogin.isLinked() } catch { isLinked = true }
    if isLinked { await connect() }

    while !Clerk.shared.isLoaded {
      try? await Task.sleep(for: .milliseconds(100))
      if Task.isCancelled { return }
    }
    if !isLinked {
      #if DEBUG && targetEnvironment(simulator)
      if Clerk.shared.session == nil, let ticket = SimulatorLaunch.consumeSignInTicket() {
        _ = try? await Clerk.shared.auth.signInWithTicket(ticket)
      }
      #endif
      // An install from before device login keeps its Clerk session and links here, with no new sign-in.
      await link(Clerk.shared.session)
    }
    for await event in Clerk.shared.auth.events {
      if case .sessionChanged(_, let session) = event, phase == .signedOut {
        await link(session)
      }
    }
  }

  /// Links this device from an active Clerk session. The Clerk session then ends: the device login
  /// replaces it.
  private func link(_ session: Session?) async {
    guard let session, session.status == .active, !SignedOutClerkSession.matches(session.id) else {
      phase = .signedOut
      return
    }
    phase = .loading
    var delay: Duration = .seconds(2)
    while true {
      switch await linkOnce(session) {
      case .linked:
        logger.info("Device linked")
        try? await Clerk.shared.auth.signOut()
        await connect()
        WidgetCenter.shared.reloadAllTimelines()
        return
      case .refused:
        logger.error("Device link refused")
        try? await Clerk.shared.auth.signOut()
        phase = .signedOut
        return
      case .retry:
        logger.info("Device link failed; retrying")
        try? await Task.sleep(for: delay)
        if Task.isCancelled { return }
        delay = min(delay * 2, .seconds(60))
      }
    }
  }

  private enum LinkOutcome {
    case linked
    case refused
    case retry
  }

  private func linkOnce(_ session: Session) async -> LinkOutcome {
    let clerkToken: String
    do {
      guard let token = try await session.getToken(.init(template: "convex", skipCache: true)) else { return .refused }
      clerkToken = token
    } catch {
      return DomaClerkTokenFailure(error) == .signedOut ? .refused : .retry
    }
    do {
      try await deviceLogin.link(clerkToken: clerkToken, label: UIDevice.current.model)
      return .linked
    } catch .rejected {
      return .refused
    } catch {
      return .retry
    }
  }

  /// Signs Convex in with the device login, retrying while the network fails.
  private func connect() async {
    var delay: Duration = .seconds(2)
    while !Task.isCancelled {
      switch await convex.login() {
      case .success:
        phase = .signedIn
        return
      case .failure(let error)
      where [.rejected, .notLinked].contains(error as? DomaDeviceLogin.Failure):
        // Rejected or gone: the provider has started `endDeviceLogin`.
        phase = .signedOut
        return
      case .failure:
        logger.info("Convex sign-in failed; retrying")
        try? await Task.sleep(for: delay)
        delay = min(delay * 2, .seconds(60))
      }
    }
  }

  /// Forgets everything signed in on this device: the device login, the Convex token and any Clerk
  /// session. Clerk's sign-out can fail offline, so the session's ID is kept to stop it relinking.
  private func endDeviceLogin() async {
    // Here rather than on the signed-out phase, which also appears briefly during a normal launch.
    LastOpenedList().forget()
    openRequest.publicId = nil
    homeOpenRequest.boardItemId = nil
    await deviceLogin.forget()
    await convex.logout()
    if let session = Clerk.shared.session {
      SignedOutClerkSession.remember(session.id)
      try? await Clerk.shared.auth.signOut()
    }
    phase = .signedOut
    // The widgets share the device login, so they show the sign-out at once rather than old lists.
    WidgetCenter.shared.reloadAllTimelines()
  }
}

/// Carries the end of the device login from the auth provider to the session, which exists only
/// after the provider.
private final class DeviceLoginEnding {
  var handler: (() async -> Void)?

  func notify() async {
    await handler?()
  }
}

/// A Clerk session signed out on this device. If Clerk's sign-out failed offline the session is
/// still stored, and must not link the device again.
private enum SignedOutClerkSession {
  private static let key = "DomaSignedOutClerkSession"

  static func remember(_ id: String) {
    UserDefaults.standard.set(id, forKey: key)
  }

  static func matches(_ id: String) -> Bool {
    UserDefaults.standard.string(forKey: key) == id
  }
}
