// swift-tools-version: 6.2

import PackageDescription

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
      ]
    ),
  ]
)
