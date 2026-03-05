declare module "../demo/web-tree-sitter.js" {
  export class Parser {
    static init(opts?: { locateFile?: (path: string) => string }): Promise<void>;
    setLanguage(lang: Language): void;
    parse(input: string): any;
  }

  export class Language {
    static load(path: string): Promise<Language>;
  }
}
