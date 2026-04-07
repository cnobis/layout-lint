// EditorView abstraction for pluggable editor implementations

import type { Highlighter } from "./tree-sitter-highlight.js";

export interface EditorView {
  getValue(): string;
  setValue(value: string): void;
  focus(): void;
  onChange(cb: (value: string) => void): void;
  destroy(): void;
  getElement(): HTMLElement;
  setBackground(color: string): void;
  setHighlighter?(highlighter: Highlighter): void;
}

export class PlainTextareaEditorView implements EditorView {
  private textarea: HTMLTextAreaElement;
  private changeCb: ((value: string) => void) | null = null;

  constructor(initialValue: string, options: { rows?: number } = {}) {
    this.textarea = document.createElement("textarea");
    this.textarea.value = initialValue;
    this.textarea.rows = options.rows ?? 12;
    this.textarea.style.width = "100%";
    this.textarea.style.flex = "1 1 auto";
    this.textarea.style.minHeight = "0";
    this.textarea.spellcheck = false;
    this.textarea.addEventListener("input", () => {
      if (this.changeCb) this.changeCb(this.textarea.value);
    });
  }

  getValue() {
    return this.textarea.value;
  }
  setValue(value: string) {
    this.textarea.value = value;
  }
  focus() {
    this.textarea.focus();
  }
  onChange(cb: (value: string) => void) {
    this.changeCb = cb;
  }
  destroy() {
    this.textarea.remove();
    this.changeCb = null;
  }
  getElement() {
    return this.textarea;
  }
  setBackground(color: string) {
    this.textarea.style.background = color;
  }
}
