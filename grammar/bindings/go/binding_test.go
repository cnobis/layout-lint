package tree_sitter_layoutlint_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_layoutlint "github.com/cnobis/layoutlint.git/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_layoutlint.Language())
	if language == nil {
		t.Errorf("Error loading layoutlint grammar")
	}
}
