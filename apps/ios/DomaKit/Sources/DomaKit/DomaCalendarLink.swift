import Foundation

/// The Home widget's event tiles open Google Calendar. A widget link always opens Doma, so the
/// widget links here and Doma passes it on: to the app, or to the website when it isn't installed.
public enum DomaCalendarLink {
  public static let url = URL(string: "com.doma.app://calendar")!
  public static let app = URL(string: "googlecalendar://")!
  public static let web = URL(string: "https://calendar.google.com")!
}
