import type { EditorView } from "./editor-view.js";

const EDITOR_STYLE_ID = "ll-highlighted-editor-style";
const EDITOR_CSS = `
.ll-editor-wrapper {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
}
.ll-editor-wrapper textarea,
.ll-editor-wrapper .ll-highlight-overlay {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
  padding: 10px;
  margin: 0;
  border: none;
  border-radius: 0;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
  box-sizing: border-box;
  width: 100%;
  min-height: 120px;
  letter-spacing: normal;
  tab-size: 4;
}
.ll-editor-wrapper textarea {
  position: relative;
  z-index: 1;
  height: 100%;
  background: transparent;
  color: transparent;
  resize: none;
  outline: none;
  display: block;
}
.ll-editor-wrapper .ll-highlight-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 0;
  pointer-events: none;
  background: transparent;
  overflow: hidden;
}
/* Dark theme */
.ll-editor-wrapper[data-editor-theme="dark"] { border: 1px solid #23272e; }
.ll-editor-wrapper[data-editor-theme="dark"] textarea { caret-color: #f3f4f6; }
.ll-editor-wrapper[data-editor-theme="dark"] .ll-highlight-overlay { color: #f3f4f6; }
.ll-editor-wrapper[data-editor-theme="dark"] .token { color: #e5e7eb; }
.ll-editor-wrapper[data-editor-theme="dark"] .token.keyword { color: #7a81ff; font-weight: 600; }
.ll-editor-wrapper[data-editor-theme="dark"] .token.number { color: #fbbf24; }
/* Light theme */
.ll-editor-wrapper[data-editor-theme="light"] { border: 1px solid #c7d2fe; }
.ll-editor-wrapper[data-editor-theme="light"] textarea { caret-color: #1f2937; }
.ll-editor-wrapper[data-editor-theme="light"] .ll-highlight-overlay { color: #1f2937; }
.ll-editor-wrapper[data-editor-theme="light"] .token { color: #374151; }
.ll-editor-wrapper[data-editor-theme="light"] .token.keyword { color: #4338ca; font-weight: 600; }
.ll-editor-wrapper[data-editor-theme="light"] .token.number { color: #b45309; }
/* Warm theme */
.ll-editor-wrapper[data-editor-theme="warm"] { border: 1px solid #d9d9cf; }
.ll-editor-wrapper[data-editor-theme="warm"] textarea { caret-color: #292524; }
.ll-editor-wrapper[data-editor-theme="warm"] .ll-highlight-overlay { color: #292524; }
.ll-editor-wrapper[data-editor-theme="warm"] .token { color: #44403c; }
.ll-editor-wrapper[data-editor-theme="warm"] .token.keyword { color: #9333ea; font-weight: 600; }
.ll-editor-wrapper[data-editor-theme="warm"] .token.number { color: #a16207; }
/* Dusk theme */
.ll-editor-wrapper[data-editor-theme="dusk"] { border: 1px solid #3d2e42; }
.ll-editor-wrapper[data-editor-theme="dusk"] textarea { caret-color: #e8d5ee; }
.ll-editor-wrapper[data-editor-theme="dusk"] .ll-highlight-overlay { color: #e8d5ee; }
.ll-editor-wrapper[data-editor-theme="dusk"] .token { color: #d4c0da; }
.ll-editor-wrapper[data-editor-theme="dusk"] .token.keyword { color: #c084fc; font-weight: 600; }
.ll-editor-wrapper[data-editor-theme="dusk"] .token.number { color: #fb923c; }
`;

function ensureEditorStyles(): void {
  if (typeof document === "undefined" || !document.getElementById || !document.head) return;
  if (document.getElementById(EDITOR_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = EDITOR_STYLE_ID;
  style.textContent = EDITOR_CSS;
  document.head.appendChild(style);
}

export class HighlightedEditorView implements EditorView {
  private wrapper: HTMLDivElement;
  private textarea: HTMLTextAreaElement;
  private overlay: HTMLDivElement;
  private changeCb: ((value: string) => void) | null = null;
  private externalTokens: Array<{ text: string; className?: string }> | null = null;

  constructor(initialValue: string) {
    ensureEditorStyles();

    this.wrapper = document.createElement("div");
    this.wrapper.className = "ll-editor-wrapper";
    this.wrapper.style.flex = "1 1 auto";
    this.wrapper.style.minHeight = "0";
    this.wrapper.style.position = "relative";

    this.overlay = document.createElement("div");
    this.overlay.className = "ll-highlight-overlay";

    this.textarea = document.createElement("textarea");
    this.textarea.value = initialValue;
    this.textarea.spellcheck = false;
    this.textarea.setAttribute("autocorrect", "off");
    this.textarea.setAttribute("autocapitalize", "off");

    this.wrapper.appendChild(this.overlay);
    this.wrapper.appendChild(this.textarea);

    // Apply default light theme
    this.setBackground("#f5f7fe");

    this.renderHighlight(initialValue);

    this.textarea.addEventListener("input", () => {
      const val = this.textarea.value;
      this.externalTokens = null;
      if (this.changeCb) this.changeCb(val);
      this.renderHighlight(val);
    });

    this.textarea.addEventListener("scroll", () => {
      this.overlay.scrollTop = this.textarea.scrollTop;
      this.overlay.scrollLeft = this.textarea.scrollLeft;
    });
  }

  setTokens(tokens: Array<{ text: string; className?: string }>) {
    this.externalTokens = tokens;
    this.renderHighlight(this.textarea.value);
  }

  private renderHighlight(text: string) {
    this.overlay.innerHTML = "";
    if (this.externalTokens) {
      for (const token of this.externalTokens) {
        if (token.text === "\n") {
          this.overlay.appendChild(document.createElement("br"));
        } else if (token.className) {
          const span = document.createElement("span");
          span.className = token.className;
          span.textContent = token.text;
          this.overlay.appendChild(span);
        } else {
          this.overlay.appendChild(document.createTextNode(token.text));
        }
      }
    } else {
      const keywords = ["above", "below", "inside", "not", "partially", "width", "height", "of"];
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; ++i) {
        if (i > 0) this.overlay.appendChild(document.createElement("br"));
        const line = lines[i];
        const tokens = line.split(/(\s+)/);
        for (const token of tokens) {
          if (token.trim() === "") {
            this.overlay.appendChild(document.createTextNode(token));
          } else if (/^\d+(px|%)?$/.test(token)) {
            const span = document.createElement("span");
            span.className = "token number";
            span.textContent = token;
            this.overlay.appendChild(span);
          } else if (keywords.includes(token)) {
            const span = document.createElement("span");
            span.className = "token keyword";
            span.textContent = token;
            this.overlay.appendChild(span);
          } else {
            const span = document.createElement("span");
            span.className = "token";
            span.textContent = token;
            this.overlay.appendChild(span);
          }
        }
      }
    }
  }

  getValue() {
    return this.textarea.value;
  }
  setValue(value: string) {
    this.textarea.value = value;
    this.renderHighlight(value);
  }
  focus() {
    this.textarea.focus();
  }
  onChange(cb: (value: string) => void) {
    this.changeCb = cb;
  }
  destroy() {
    this.wrapper.remove();
    this.changeCb = null;
  }
  getElement() {
    return this.wrapper;
  }
  setBackground(color: string) {
    this.wrapper.style.background = color;
    if (color === "#f5f7fe") {
      this.wrapper.dataset.editorTheme = "light";
    } else if (color === "#f3f3ed") {
      this.wrapper.dataset.editorTheme = "warm";
    } else if (color === "#2a1f2e") {
      this.wrapper.dataset.editorTheme = "dusk";
    } else {
      this.wrapper.dataset.editorTheme = "dark";
    }
  }
}
