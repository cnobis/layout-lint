/**
 * Live AST viewer for the "internals" demo page.
 *
 * Parses layout-lint DSL with the real tree-sitter grammar and renders the
 * concrete syntax tree next to an editable source pane. Hovering a tree node
 * highlights the matching source span (and vice-versa), making the
 * source -> parse-tree correspondence concrete.
 *
 * Self-contained on purpose: it depends only on the core parser
 * (`getParser`), not on the devtools widget, so the demo page stays simple.
 */
import type { Node, Tree } from "web-tree-sitter";
import { getParser } from "../../core/parser.js";

export interface AstViewerHandles {
  setSpec(text: string): void;
  destroy(): void;
}

export interface AstViewerOptions {
  /** Host element for the source editor. */
  editorHost: HTMLElement;
  /** Host element for the rendered tree. */
  treeHost: HTMLElement;
  /** Initial DSL spec. */
  initialSpec: string;
  /** Optional host for a "Show anonymous nodes" toggle. */
  toolbarHost?: HTMLElement;
}

const STYLE_ID = "ll-ast-view-styles";
const MAX_LEAF_TEXT = 40;

const AST_CSS = `
.ll-ast-editor {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  border-radius: var(--ll-radius-md, 10px);
  border: 1px solid var(--ll-border, rgba(255,255,255,0.1));
  background: var(--ll-surface, #171a22);
  overflow: hidden;
}
.ll-ast-editor pre,
.ll-ast-editor textarea {
  margin: 0;
  padding: 14px 16px;
  border: 0;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0;
  tab-size: 2;
  white-space: pre-wrap;
  word-break: break-word;
  overflow: auto;
}
.ll-ast-editor pre {
  position: absolute;
  inset: 0;
  color: var(--ll-text, #eceeff);
  pointer-events: none;
}
.ll-ast-editor textarea {
  position: absolute;
  inset: 0;
  background: transparent;
  color: transparent;
  caret-color: var(--ll-accent, #7a81ff);
  resize: none;
  outline: none;
}
.ll-ast-editor mark {
  background: color-mix(in srgb, var(--ll-accent, #7a81ff) 38%, transparent);
  color: inherit;
  border-radius: 3px;
}
.ll-ast-tree {
  flex: 1 1 0;
  min-height: 0;
  overflow: auto;
  padding: 8px 4px;
  font: 12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--ll-text, #eceeff);
}
.ll-ast-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 1px 8px;
  border-radius: 5px;
  cursor: default;
  white-space: nowrap;
}
.ll-ast-row:hover,
.ll-ast-row.ll-ast-active {
  background: color-mix(in srgb, var(--ll-accent, #7a81ff) 22%, transparent);
}
.ll-ast-field { color: var(--ll-accent, #7a81ff); font-style: italic; }
.ll-ast-field::after { content: ":"; color: var(--ll-muted, #9aa3b8); }
.ll-ast-type { color: var(--ll-text, #eceeff); font-weight: 600; }
.ll-ast-type.ll-ast-anon { color: var(--ll-muted, #9aa3b8); font-weight: 400; }
.ll-ast-text { color: var(--ll-positive, #5cffaa); }
.ll-ast-type.ll-ast-error { color: var(--ll-danger, #ff6b81); }
.ll-ast-pos { color: var(--ll-muted, #9aa3b8); opacity: 0.7; }
.ll-ast-toggle {
  display: inline-flex; align-items: center; gap: 6px;
  font: 12px/1 var(--ll-font-sans, system-ui), sans-serif;
  color: var(--ll-muted, #9aa3b8); cursor: pointer; user-select: none;
}
`;

function ensureStyles(): void {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = AST_CSS;
  document.head.appendChild(style);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Mount the live AST viewer. Resolves once the parser WASM is ready. */
export async function mountAstViewer(
  opts: AstViewerOptions,
): Promise<AstViewerHandles> {
  ensureStyles();

  // ── Editor: transparent textarea over a highlight mirror ──────────
  const editor = document.createElement("div");
  editor.className = "ll-ast-editor";
  const mirror = document.createElement("pre");
  mirror.setAttribute("aria-hidden", "true");
  const textarea = document.createElement("textarea");
  textarea.spellcheck = false;
  textarea.setAttribute("autocorrect", "off");
  textarea.setAttribute("autocapitalize", "off");
  textarea.value = opts.initialSpec;
  editor.append(mirror, textarea);
  opts.editorHost.appendChild(editor);

  // ── Tree container + optional toggle ──────────────────────────────
  const tree = document.createElement("div");
  tree.className = "ll-ast-tree";
  opts.treeHost.appendChild(tree);

  let showAnonymous = false;
  if (opts.toolbarHost) {
    const label = document.createElement("label");
    label.className = "ll-ast-toggle";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    label.append(cb, document.createTextNode("Show anonymous nodes"));
    cb.addEventListener("change", () => {
      showAnonymous = cb.checked;
      renderTree();
    });
    opts.toolbarHost.appendChild(label);
  }

  const parser = await getParser();
  let currentTree: Tree | null = null;

  // ── Source mirror with optional highlighted span ──────────────────
  function renderMirror(range?: { start: number; end: number }): void {
    const text = textarea.value;
    if (!range) {
      mirror.textContent = text;
      return;
    }
    const { start, end } = range;
    mirror.innerHTML =
      escapeHtml(text.slice(0, start)) +
      "<mark>" +
      escapeHtml(text.slice(start, end)) +
      "</mark>" +
      escapeHtml(text.slice(end));
  }

  function syncScroll(): void {
    mirror.scrollTop = textarea.scrollTop;
    mirror.scrollLeft = textarea.scrollLeft;
  }

  // ── Tree rendering ────────────────────────────────────────────────
  function renderTree(): void {
    tree.textContent = "";
    if (!currentTree) return;
    const frag = document.createDocumentFragment();
    renderNode(currentTree.rootNode, 0, null, frag);
    tree.appendChild(frag);
  }

  function renderNode(
    node: Node,
    depth: number,
    fieldName: string | null,
    parent: DocumentFragment | HTMLElement,
  ): void {
    const row = document.createElement("div");
    row.className = "ll-ast-row";
    row.style.paddingLeft = `${8 + depth * 16}px`;
    row.dataset.start = String(node.startIndex);
    row.dataset.end = String(node.endIndex);

    if (fieldName) {
      const f = document.createElement("span");
      f.className = "ll-ast-field";
      f.textContent = fieldName;
      row.appendChild(f);
    }

    const type = document.createElement("span");
    const isError = node.type === "ERROR" || node.isMissing;
    type.className =
      "ll-ast-type" +
      (node.isNamed ? "" : " ll-ast-anon") +
      (isError ? " ll-ast-error" : "");
    type.textContent = node.isMissing ? `MISSING ${node.type}` : node.type;
    row.appendChild(type);

    // Decide which children to render.
    const renderable: Array<{ child: Node; field: string | null }> = [];
    for (let i = 0; i < node.childCount; i += 1) {
      const child = node.child(i);
      if (!child) continue;
      if (!showAnonymous && !child.isNamed) continue;
      renderable.push({ child, field: node.fieldNameForChild(i) });
    }

    // Leaf (nothing to expand): show the matched source text.
    if (renderable.length === 0) {
      const txt = node.text;
      if (txt && txt.length <= MAX_LEAF_TEXT) {
        const t = document.createElement("span");
        t.className = "ll-ast-text";
        t.textContent = node.isNamed ? txt : `"${txt}"`;
        row.appendChild(t);
      }
    }

    const pos = document.createElement("span");
    pos.className = "ll-ast-pos";
    pos.textContent = `${node.startIndex}–${node.endIndex}`;
    row.appendChild(pos);

    row.addEventListener("mouseenter", () => {
      renderMirror({ start: node.startIndex, end: node.endIndex });
      syncScroll();
    });
    row.addEventListener("mouseleave", () => {
      renderMirror();
    });

    parent.appendChild(row);
    for (const { child, field } of renderable) {
      renderNode(child, depth + 1, field, parent);
    }
  }

  // ── Parse + render pipeline (debounced) ───────────────────────────
  // Specs are tiny; a full reparse each time keeps things simple and avoids
  // the tree.edit() bookkeeping that incremental parsing would require.
  function parseNow(): void {
    const previous = currentTree;
    currentTree = parser.parse(textarea.value);
    previous?.delete();
    renderTree();
  }

  let debounce: ReturnType<typeof setTimeout> | null = null;
  function scheduleParse(): void {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(parseNow, 140);
  }

  const onInput = () => {
    renderMirror();
    scheduleParse();
  };
  textarea.addEventListener("input", onInput);
  textarea.addEventListener("scroll", syncScroll);

  // Initial paint.
  renderMirror();
  parseNow();

  return {
    setSpec(text: string) {
      textarea.value = text;
      currentTree = null;
      renderMirror();
      parseNow();
    },
    destroy() {
      if (debounce) clearTimeout(debounce);
      textarea.removeEventListener("input", onInput);
      textarea.removeEventListener("scroll", syncScroll);
      currentTree?.delete();
      currentTree = null;
      editor.remove();
      tree.remove();
    },
  };
}
