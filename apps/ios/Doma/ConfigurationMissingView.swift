import SwiftUI

struct ConfigurationMissingView: View {
  var body: some View {
    DomaStateView(
      title: "Doma is not configured",
      systemImage: "gearshape",
      message: "Copy Config/Local.example.xcconfig to Config/Local.xcconfig and rebuild."
    )
  }
}
