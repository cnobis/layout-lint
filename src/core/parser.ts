// @ts-expect-error no types for this local js
import { Parser, Language } from "../../demo/web-tree-sitter.js";

let _parserPromise: Promise<Parser> | null = null;

export async function getParser(wasmUrl: string, locateFile?: (path: string) => string): Promise<Parser> {
  if (!_parserPromise) {
    _parserPromise = (async () => {
      await Parser.init({ locateFile });
      const lang = await Language.load(wasmUrl);
      const parser = new Parser();
      parser.setLanguage(lang);
      return parser;
    })();
  }
  return _parserPromise;
}
