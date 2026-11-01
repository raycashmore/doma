import SwiftUI

struct ConfigurationMissingView: View {
  var body: some View {
    ContentUnavailableView(
      "Doma is not configured",
      systemImage: "gearshape",
      description: Text("Copy Config/Local.example.xcconfig to Config/Local.xcconfig and rebuild.")
    )
  }
}
