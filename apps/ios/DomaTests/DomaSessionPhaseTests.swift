@preconcurrency import ConvexMobile
import Testing

@testable import Doma

@MainActor
struct DomaSessionPhaseTests {
  @Test func aBackgroundReloginKeepsTheSignedInScreens() {
    #expect(DomaSession.Phase.signedIn.next(after: .loading, isClerkLoaded: true) == .signedIn)
  }

  @Test func aFirstLoginStillShowsLoading() {
    #expect(DomaSession.Phase.signedOut.next(after: .loading, isClerkLoaded: true) == .loading)
    #expect(DomaSession.Phase.loading.next(after: .loading, isClerkLoaded: false) == .loading)
  }

  @Test func aFailedReloginStillSignsOut() {
    #expect(DomaSession.Phase.signedIn.next(after: .unauthenticated, isClerkLoaded: true) == .signedOut)
  }

  @Test func authenticationSignsIn() {
    #expect(DomaSession.Phase.loading.next(after: .authenticated("token"), isClerkLoaded: true) == .signedIn)
  }
}
