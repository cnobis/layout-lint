import { GRAMMAR_WASM_BASE64, RUNTIME_WASM_BASE64 } from "./wasm-data.js";

const MISSING_PAYLOAD =
  "layout-lint: inlined WASM payload is missing. Run `npm run build:ts` to populate dist/core/wasm-data.js, or pass `wasmUrl` and `locateFile` explicitly.";

function decode(b64: string): Uint8Array {
  if (!b64) throw new Error(MISSING_PAYLOAD);
  // Node: use Buffer when available. Avoids pulling in @types/node.
  const buf = (globalThis as { Buffer?: { from(data: string, enc: string): Uint8Array } }).Buffer;
  if (buf) {
    return new Uint8Array(buf.from(b64, "base64"));
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let grammarBytes: Uint8Array | null = null;
let runtimeBytes: Uint8Array | null = null;

export function getInlinedGrammar(): Uint8Array {
  if (!grammarBytes) grammarBytes = decode(GRAMMAR_WASM_BASE64);
  return grammarBytes;
}

export function getInlinedRuntime(): Uint8Array {
  if (!runtimeBytes) runtimeBytes = decode(RUNTIME_WASM_BASE64);
  return runtimeBytes;
}
