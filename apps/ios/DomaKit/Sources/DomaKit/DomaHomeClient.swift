import Combine
@preconcurrency import ConvexMobile
import Foundation

/// The household noticeboard, as `packages/convex/convex/home/activeBoard.ts` returns it.
public struct DomaHomeBoard: Decodable, Equatable, Sendable {
  /// Today in the household's time zone, `YYYY-MM-DD`.
  public let localDate: String
  public let timeZone: String
  /// In the server's order. Kinds this app does not know are dropped.
  public let items: [DomaBoardItem]

  private enum CodingKeys: String, CodingKey { case localDate, timeZone, items }

  public init(localDate: String, timeZone: String, items: [DomaBoardItem]) {
    self.localDate = localDate
    self.timeZone = timeZone
    self.items = items
  }

  public init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    localDate = try container.decode(String.self, forKey: .localDate)
    timeZone = try container.decode(String.self, forKey: .timeZone)
    items = try container.decode([OptionalBoardItem].self, forKey: .items).compactMap(\.item)
  }
}

/// One card on the board.
public enum DomaBoardItem: Equatable, Identifiable, Sendable {
  case today(DomaBoardToday)
  case meals(DomaBoardMeals)
  case note(DomaBoardNote)
  case emailNotice(DomaBoardEmailNotice)
  case spendingInsight(DomaBoardSpendingInsight)

  /// The occurrence id the board and archives share, such as `manualNote:<id>`.
  public var id: String {
    switch self {
    case .today(let item): item.id
    case .meals(let item): item.id
    case .note(let item): item.id
    case .emailNotice(let item): item.id
    case .spendingInsight(let item): item.id
    }
  }

  /// The `sourceKind` that `home/archives:archiveBoardItem` expects.
  public var archiveSourceKind: String {
    switch self {
    case .today: "today"
    case .meals: "meals"
    case .note: "manualNote"
    case .emailNotice: "forwardedEmail"
    case .spendingInsight: "monthlySpendingInsight"
    }
  }

  /// The server's layout hint: wide cards are urgent, compact ones quiet.
  public var display: DomaBoardDisplay {
    switch self {
    case .today, .meals: .standard
    case .note(let item): item.display
    case .emailNotice(let item): item.display
    case .spendingInsight(let item): item.display
    }
  }
}

public enum DomaBoardDisplay: String, Decodable, Sendable {
  case wide, standard, compact
}

public enum DomaDueState: String, Decodable, Sendable {
  case none, overdue, dueToday, upcoming
}

public struct DomaBoardToday: Decodable, Equatable, Sendable {
  public let id: String
  public let briefingStatus: BriefingStatus
  public let headline: String
  /// Milliseconds since 1970, or `nil` before the morning briefing runs.
  public let generatedAt: Double?
  public let morning: [Line]
  public let laterToday: [Event]
  public let watchouts: [Line]

  public enum BriefingStatus: String, Decodable, Sendable {
    case missing, empty, available
  }

  public struct Line: Decodable, Equatable, Sendable {
    public let text: String
    public let who: [String]
  }

  public struct Event: Decodable, Equatable, Identifiable, Sendable {
    public let id: String
    public let title: String
    public let detail: String?
    public let start: Double
    public let end: Double
    public let allDay: Bool
    public let who: [String]
  }
}

public struct DomaBoardMeals: Decodable, Equatable, Sendable {
  public let id: String
  /// `nil` when nothing is planned.
  public let schoolLunch: String?
  public let dinner: String?
}

public struct DomaBoardNote: Decodable, Equatable, Sendable {
  public let id: String
  /// The `manualNotes` document id, for editing.
  public let noteId: String
  public let display: DomaBoardDisplay
  public let title: String
  public let detail: String?
  /// `YYYY-MM-DD`.
  public let dueDate: String?
  public let dueState: DomaDueState
}

public struct DomaBoardEmailNotice: Decodable, Equatable, Sendable {
  public let id: String
  public let display: DomaBoardDisplay
  public let priority: Priority
  public let title: String
  public let detail: String
  public let facts: [Fact]
  /// `YYYY-MM-DD`, set when the email asks for something by a date.
  public let dueDate: String?
  public let dueState: DomaDueState?
  public let obligationAction: String?
  /// When the email arrived, in milliseconds since 1970.
  public let occurredAt: Double

  public enum Priority: String, Decodable, Sendable {
    case high, medium, low
  }

  public struct Fact: Decodable, Equatable, Sendable {
    public let label: String
    public let value: String
  }
}

public struct DomaBoardSpendingInsight: Decodable, Equatable, Sendable {
  public let id: String
  public let display: DomaBoardDisplay
  /// The generated headline: a sentence, not a title.
  public let title: String
  public let detail: String
  /// The month it covers, `YYYY-MM`.
  public let period: String
}

/// Decodes one board item, or `nil` for a kind this app does not know, so a new kind on the
/// server leaves the rest of the board readable.
private struct OptionalBoardItem: Decodable {
  let item: DomaBoardItem?

  private enum CodingKeys: String, CodingKey { case kind, sourceKind }

  init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    switch try container.decode(String.self, forKey: .kind) {
    case "today": item = .today(try DomaBoardToday(from: decoder))
    case "meals": item = .meals(try DomaBoardMeals(from: decoder))
    case "manualNote": item = .note(try DomaBoardNote(from: decoder))
    case "sourceNotice":
      switch try container.decode(String.self, forKey: .sourceKind) {
      case "forwardedEmail": item = .emailNotice(try DomaBoardEmailNotice(from: decoder))
      case "monthlySpendingInsight": item = .spendingInsight(try DomaBoardSpendingInsight(from: decoder))
      default: item = nil
      }
    default: item = nil
    }
  }
}

/// Typed wrappers for `packages/convex/convex/home/`.
public struct DomaHomeClient: Sendable {
  private let convex: ConvexClient

  public init(convex: ConvexClient) {
    self.convex = convex
  }

  /// The live board. The server reads the clock when the query runs, so callers pass a new
  /// `refreshToken` from time to time to have today, overdue and later-today worked out again.
  public func board(refreshToken: Double) -> AnyPublisher<DomaHomeBoard, ClientError> {
    convex.subscribe(to: "home/activeBoard:activeBoard", with: ["refreshToken": refreshToken])
  }

  public func createNote(title: String, detail: String?, dueDate: String?) async throws {
    let _: IgnoredResult = try await convex.mutation(
      "home/manualNotes:createManualNote", with: Self.noteArgs(title: title, detail: detail, dueDate: dueDate))
  }

  /// Replaces the note's fields: a `nil` detail or due date clears it.
  public func updateNote(noteId: String, title: String, detail: String?, dueDate: String?) async throws {
    var args = Self.noteArgs(title: title, detail: detail, dueDate: dueDate)
    args["noteId"] = noteId
    let _: IgnoredResult = try await convex.mutation("home/manualNotes:updateManualNote", with: args)
  }

  /// Hides the card for everyone in the household.
  public func archive(_ item: DomaBoardItem) async throws {
    let _: IgnoredResult = try await convex.mutation(
      "home/archives:archiveBoardItem", with: ["occurrenceId": item.id, "sourceKind": item.archiveSourceKind])
  }

  /// Optional fields are left out rather than sent as `null`, which `v.optional` rejects.
  private static func noteArgs(title: String, detail: String?, dueDate: String?) -> [String: ConvexEncodable?] {
    var args: [String: ConvexEncodable?] = ["title": title]
    if let detail { args["detail"] = detail }
    if let dueDate { args["dueDate"] = dueDate }
    return args
  }
}
