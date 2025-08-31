// swift-tools-version:5.3

import Foundation
import PackageDescription

var sources = ["src/parser.c"]
if FileManager.default.fileExists(atPath: "src/scanner.c") {
    sources.append("src/scanner.c")
}

let package = Package(
    name: "TreeSitterLayoutLint",
    products: [
        .library(name: "TreeSitterLayoutLint", targets: ["TreeSitterLayoutLint"]),
    ],
    dependencies: [
        .package(name: "SwiftTreeSitter", url: "https://github.com/tree-sitter/swift-tree-sitter", from: "0.9.0"),
    ],
    targets: [
        .target(
            name: "TreeSitterLayoutLint",
            dependencies: [],
            path: ".",
            sources: sources,
            resources: [
                .copy("queries")
            ],
            publicHeadersPath: "bindings/swift",
            cSettings: [.headerSearchPath("src")]
        ),
        .testTarget(
            name: "TreeSitterLayoutLintTests",
            dependencies: [
                "SwiftTreeSitter",
                "TreeSitterLayoutLint",
            ],
            path: "bindings/swift/TreeSitterLayoutLintTests"
        )
    ],
    cLanguageStandard: .c11
)
