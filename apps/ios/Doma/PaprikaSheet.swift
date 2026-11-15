import DomaKit
import SwiftUI

/// Connect the signed-in person's own Paprika account and choose which Paprika list items come from.
struct PaprikaSheet: View {
  let paprika: DomaPaprikaClient
  @Environment(\.dismiss) private var dismiss
  @State private var connection: DomaPaprikaConnection??
  @State private var loadFailed = false

  var body: some View {
    NavigationStack {
      Group {
        switch PaprikaConnectionCopy.screen(for: connection) {
        case .loading:
          if loadFailed {
            DomaStateView(title: "Paprika settings are unavailable", systemImage: "exclamationmark.triangle")
          } else {
            DomaLoadingView()
          }
        case .signIn(let isReconnect):
          PaprikaSignInForm(paprika: paprika, isReconnect: isReconnect)
        case .connected(let connection):
          PaprikaConnectedForm(paprika: paprika, connection: connection)
        }
      }
      .domaScreenBackground()
      .navigationTitle("Paprika")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          Button("Done") { dismiss() }
        }
      }
    }
    .tint(DomaColor.warmTextPrimary)
    .presentationDetents([.medium, .large])
    .task {
      await followLiveQuery(
        "paprika connection", subscribe: paprika.connection, onFailure: { loadFailed = true }
      ) { connection = .some($0) }
    }
  }
}

private struct PaprikaSignInForm: View {
  let paprika: DomaPaprikaClient
  let isReconnect: Bool
  @State private var email = ""
  @State private var password = ""
  @State private var isConnecting = false
  @State private var problem: String?

  private var trimmedEmail: String { email.trimmingCharacters(in: .whitespacesAndNewlines) }

  var body: some View {
    Form {
      if isReconnect {
        Section {
          Label(PaprikaConnectionCopy.reconnectNotice, systemImage: "exclamationmark.triangle")
            .domaFont(.body)
        }
        .listRowBackground(DomaColor.warmBgCard)
      }
      Section {
        TextField("Email", text: $email, prompt: Text("Paprika email").foregroundStyle(DomaColor.warmTextSecondary))
          .domaFont(.body)
          .textContentType(.username)
          .keyboardType(.emailAddress)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
        SecureField("Password", text: $password, prompt: Text("Password").foregroundStyle(DomaColor.warmTextSecondary))
          .domaFont(.body)
          .textContentType(.password)
          .submitLabel(.go)
          .onSubmit { Task { await connect() } }
      } footer: {
        Text(PaprikaConnectionCopy.tokenFootnote)
          .domaFont(.supporting)
          .foregroundStyle(DomaColor.warmTextSecondary)
      }
      .listRowBackground(DomaColor.warmBgCard)
      Section {
        Button {
          Task { await connect() }
        } label: {
          if isConnecting {
            ProgressView()
          } else {
            Text(isReconnect ? "Reconnect" : "Connect").domaFont(.body)
          }
        }
        .disabled(trimmedEmail.isEmpty || password.isEmpty || isConnecting)
      }
      .listRowBackground(DomaColor.warmBgCard)
      if isReconnect {
        Section { PaprikaDisconnectButton(paprika: paprika) }
          .listRowBackground(DomaColor.warmBgCard)
      }
    }
    .alert(
      "Paprika isn't connected",
      isPresented: Binding(get: { problem != nil }, set: { if !$0 { problem = nil } })
    ) {
      Button("OK", role: .cancel) {}
    } message: {
      Text(problem ?? "")
    }
  }

  /// One sign-in per tap; the live connection swaps this form out once it works.
  private func connect() async {
    guard !trimmedEmail.isEmpty, !password.isEmpty, !isConnecting else { return }
    isConnecting = true
    defer { isConnecting = false }
    do {
      let result = try await paprika.connect(email: trimmedEmail, password: password)
      problem = PaprikaConnectionCopy.connectProblem(result)
      if problem == nil { password = "" }
    } catch {
      problem = PaprikaConnectionCopy.connectProblem(.unavailable(httpStatus: nil))
    }
  }
}

private struct PaprikaConnectedForm: View {
  let paprika: DomaPaprikaClient
  let connection: DomaPaprikaConnection
  /// A choice still saving, shown until the live connection confirms it.
  @State private var pendingSource: String?
  @State private var lastSave: Task<Void, Never>?
  @State private var savesInFlight = 0
  @State private var isChecking = false
  @State private var checkedAt: Date?
  @State private var problem: String?
  @State private var saveFailed = false

  var body: some View {
    Form {
      Section {
        Picker("Bring items from", selection: sourceSelection) {
          if connection.sourceListUid == nil && pendingSource == nil {
            Text("Choose a list").tag(String?.none)
          }
          ForEach(connection.groceryLists) { list in
            Text(list.name).tag(String?.some(list.uid))
          }
        }
        .domaFont(.body)
        LabeledContent("Into") {
          Text(connection.groceriesList?.name ?? "No Groceries list")
            .foregroundStyle(DomaColor.warmTextSecondary)
        }
        .domaFont(.body)
      } header: {
        Text("Grocery items")
      } footer: {
        Text(
          "Items go to your Groceries list. To change it, open a list's settings and choose Set as Groceries List. "
            + "This is your own Paprika account; others in the household connect theirs separately."
        )
          .domaFont(.supporting)
          .foregroundStyle(DomaColor.warmTextSecondary)
      }
      .listRowBackground(DomaColor.warmBgCard)
      Section {
        Button {
          Task { await check() }
        } label: {
          if isChecking {
            ProgressView()
          } else {
            Text("Check Connection").domaFont(.body)
          }
        }
        .disabled(isChecking)
        PaprikaDisconnectButton(paprika: paprika)
      } footer: {
        if let checkedAt {
          Text("Paprika answered \(checkedAt, style: .relative) ago.")
            .domaFont(.supporting)
            .foregroundStyle(DomaColor.warmTextSecondary)
        }
      }
      .listRowBackground(DomaColor.warmBgCard)
    }
    .onChange(of: connection) {
      if pendingSource == connection.sourceListUid { pendingSource = nil }
    }
    .alert(
      "Paprika didn't answer",
      isPresented: Binding(get: { problem != nil }, set: { if !$0 { problem = nil } })
    ) {
      Button("OK", role: .cancel) {}
    } message: {
      Text(problem ?? "")
    }
    .domaSaveFailureAlert(isPresented: $saveFailed)
  }

  private var sourceSelection: Binding<String?> {
    Binding(
      get: { pendingSource ?? connection.sourceListUid },
      set: { uid in
        guard let uid else { return }
        pendingSource = uid == connection.sourceListUid && savesInFlight == 0 ? nil : uid
        enqueueSave(clearing: { if pendingSource == uid { pendingSource = nil } }) {
          try await paprika.setSourceList(uid: uid)
        }
      }
    )
  }

  private func check() async {
    isChecking = true
    defer { isChecking = false }
    do {
      let result = try await paprika.checkConnection()
      problem = PaprikaConnectionCopy.checkProblem(result)
      checkedAt = problem == nil ? Date() : nil
    } catch {
      problem = PaprikaConnectionCopy.checkProblem(.unavailable(httpStatus: nil))
    }
  }

  /// Each save waits for the one before, so quick picks land in the order they were made.
  private func enqueueSave(clearing clear: @escaping () -> Void, _ change: @escaping () async throws -> Void) {
    let previous = lastSave
    savesInFlight += 1
    lastSave = Task {
      await previous?.value
      defer { savesInFlight -= 1 }
      do {
        try await change()
      } catch {
        clear()
        saveFailed = true
      }
    }
  }
}

/// Forgets the person's Paprika sign-in and choices, after confirmation.
private struct PaprikaDisconnectButton: View {
  let paprika: DomaPaprikaClient
  @State private var isConfirming = false
  @State private var saveFailed = false

  var body: some View {
    Button("Disconnect Paprika", role: .destructive) { isConfirming = true }
      .domaFont(.body)
      .confirmationDialog("Disconnect Paprika?", isPresented: $isConfirming, titleVisibility: .visible) {
        Button("Disconnect", role: .destructive) {
          Task {
            do {
              try await paprika.disconnect()
            } catch {
              saveFailed = true
            }
          }
        }
      } message: {
        Text("Doma forgets your Paprika sign-in. Items already in your lists stay.")
      }
      .domaSaveFailureAlert(isPresented: $saveFailed)
  }
}
