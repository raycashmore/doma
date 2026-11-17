import Foundation

/// The Home widget's event tiles open Google Calendar. A widget link always opens Doma, so the
/// widget links here and Doma passes it on: to Google Calendar, or Apple Calendar when it isn't installed.
public enum DomaCalendarLink {
  public static let url = URL(string: "com.doma.app://calendar")!
  public static let google = URL(string: "googlecalendar://")!
  public static let apple = URL(string: "calshow://")!
}
