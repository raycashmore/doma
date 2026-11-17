import Foundation

/// The Home widget's event tiles open Apple Calendar. A widget link always opens Doma, so the
/// widget links here and Doma passes it on.
public enum DomaCalendarLink {
  public static let url = URL(string: "com.doma.app://calendar")!
  public static let calendar = URL(string: "calshow://")!
}
