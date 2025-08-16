import XCTest
import SwiftTreeSitter
import TreeSitterLayoutlint

final class TreeSitterLayoutlintTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_layoutlint())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading layoutlint grammar")
    }
}
