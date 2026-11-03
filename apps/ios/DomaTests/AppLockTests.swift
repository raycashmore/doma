import Testing

@testable import Doma

struct AppLockTests {
  private let start = ContinuousClock.now

  @Test func startsLockedOnColdLaunch() {
    #expect(AppLock().isLocked)
  }

  @Test func staysUnlockedAfterABriefTripToTheBackground() {
    var lock = AppLock()
    lock.unlock()
    lock.enterBackground(at: start)

    let shouldPrompt = lock.returnToForeground(at: start + .seconds(299))

    #expect(!shouldPrompt)
    #expect(!lock.isLocked)
  }

  @Test func locksAfterFiveMinutesInTheBackground() {
    var lock = AppLock()
    lock.unlock()
    lock.enterBackground(at: start)

    let shouldPrompt = lock.returnToForeground(at: start + .seconds(300))

    #expect(shouldPrompt)
    #expect(lock.isLocked)
  }

  @Test func activatingWithoutBackgroundingDoesNotPromptAgain() {
    // A Face ID sheet makes the scene inactive then active; that must not re-prompt.
    var lock = AppLock()

    let shouldPrompt = lock.returnToForeground(at: start + .seconds(600))

    #expect(!shouldPrompt)
    #expect(lock.isLocked)
  }

  @Test func backgroundTimeIsMeasuredFromTheLatestTrip() {
    var lock = AppLock()
    lock.unlock()
    lock.enterBackground(at: start)
    _ = lock.returnToForeground(at: start + .seconds(200))
    lock.enterBackground(at: start + .seconds(400))

    let shouldPrompt = lock.returnToForeground(at: start + .seconds(500))

    #expect(!shouldPrompt)
    #expect(!lock.isLocked)
  }

  @Test func promptsAgainWhenReturningFromTheBackgroundStillLocked() {
    // After a cancelled prompt, leaving and coming back should ask again.
    var lock = AppLock()
    lock.enterBackground(at: start)

    let shouldPrompt = lock.returnToForeground(at: start + .seconds(10))

    #expect(shouldPrompt)
    #expect(lock.isLocked)
  }
}
