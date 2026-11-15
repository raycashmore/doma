// swift-tools-version: 6.2

import PackageDescription

// CI sets DOMA_STRICT_WARNINGS=YES so a warning in DomaKit fails the build, as in the app.
let strictWarnings: [SwiftSetting] =
  Context.environment["DOMA_STRICT_WARNINGS"] == "YES" ? [.treatAllWarnings(as: .error)] : []

let package = Package(
  name: "DomaKit",
  platforms: [
    .iOS("27.0"),
  ],
  products: [
    .library(name: "DomaKit", targets: ["DomaKit"]),
  ],
  dependencies: [
    .package(url: "https://github.com/clerk/clerk-ios", exact: "1.6.2"),
    .package(url: "https://github.com/get-convex/convex-swift", exact: "0.8.2"),
  ],
  targets: [
    .target(
      name: "DomaKit",
      dependencies: [
        .product(name: "ClerkKit", package: "clerk-ios"),
        .product(name: "ConvexMobile", package: "convex-swift"),
      ],
      swiftSettings: strictWarnings
    ),
  ]
)
