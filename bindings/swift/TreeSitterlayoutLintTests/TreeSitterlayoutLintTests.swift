import XCTest
import SwiftTreeSitter
import TreeSitterLayoutLint

final class TreeSitterLayoutLintTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_layout_lint())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading layout-lint grammar")
    }
}
