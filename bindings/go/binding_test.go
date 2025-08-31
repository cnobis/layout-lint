package tree_sitter_layout_lint_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_layout_lint "github.com/cnobis/layout-lint/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_layout_lint.Language())
	if language == nil {
		t.Errorf("Error loading layout-lint grammar")
	}
}
