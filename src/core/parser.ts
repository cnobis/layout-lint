// @ts-expect-error no types for this local js
import { Parser, Language } from "../../demo/web-tree-sitter.js";

let _initPromise: Promise<{ parser: Parser; language: Language }> | null = null;

function ensureInit(wasmUrl: string, locateFile?: (path: string) => string): Promise<{ parser: Parser; language: Language }> {
  if (!_initPromise) {
    _initPromise = (async () => {
      await Parser.init({ locateFile });
      const language = await Language.load(wasmUrl);
      const parser = new Parser();
      parser.setLanguage(language);
      return { parser, language };
    })();
  }
  return _initPromise;
}

export async function getParser(wasmUrl: string, locateFile?: (path: string) => string): Promise<Parser> {
  const { parser } = await ensureInit(wasmUrl, locateFile);
  return parser;
}

export async function getLanguage(wasmUrl: string, locateFile?: (path: string) => string): Promise<Language> {
  const { language } = await ensureInit(wasmUrl, locateFile);
  return language;
}
