import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const entries = [
  { in: "dist/auto.js", out: "dist/auto.bundle.js" },
  { in: "dist/web-component.js", out: "dist/web-component.bundle.js" },
  { in: "dist/devtools/internals/main.js", out: "dist/internals.bundle.js" },
];

await Promise.all(
  entries.map((entry) =>
    build({
      absWorkingDir: root,
      entryPoints: [entry.in],
      outfile: entry.out,
      bundle: true,
      format: "esm",
      platform: "browser",
      target: ["es2022"],
      minify: true,
      sourcemap: false,
      legalComments: "none",
      logLevel: "info",
      alias: {
        "fs/promises": resolve(here, "empty-shim.mjs"),
        module: resolve(here, "empty-shim.mjs"),
      },
    }),
  ),
);
