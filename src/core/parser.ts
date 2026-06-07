import { Parser, Language } from "web-tree-sitter";
import { getInlinedGrammar, getInlinedRuntime } from "./wasm-inline.js";

let _initPromise: Promise<{ parser: Parser; language: Language }> | null = null;

function ensureInit(
  wasmUrl?: string,
  locateFile?: (path: string) => string,
): Promise<{ parser: Parser; language: Language }> {
  if (!_initPromise) {
    _initPromise = (async () => {
      // Runtime WASM: prefer the caller's locator, otherwise fall back to the
      // base64 payload baked into the dist bundle. No tree-sitter.wasm needs
      // to sit next to the script.
      const moduleOptions: Record<string, unknown> = {};
      if (locateFile) {
        moduleOptions.locateFile = locateFile;
      } else {
        moduleOptions.wasmBinary = getInlinedRuntime();
      }
      await Parser.init(moduleOptions);

      // Grammar WASM: prefer the caller's URL, otherwise use the inlined bytes.
      const language = await Language.load(wasmUrl ?? getInlinedGrammar());
      const parser = new Parser();
      parser.setLanguage(language);
      return { parser, language };
    })();
  }
  return _initPromise;
}

export async function getParser(
  wasmUrl?: string,
  locateFile?: (path: string) => string,
): Promise<Parser> {
  const { parser } = await ensureInit(wasmUrl, locateFile);
  return parser;
}

export async function getLanguage(
  wasmUrl?: string,
  locateFile?: (path: string) => string,
): Promise<Language> {
  const { language } = await ensureInit(wasmUrl, locateFile);
  return language;
}
