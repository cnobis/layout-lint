/**
 * Entry point for the "internals" demo page (demo/internals/index.html).
 * Bundled to dist/internals.bundle.js by scripts/build-bundles.mjs.
 *
 * Wires the page's editor/tree hosts to the live AST viewer and exposes a few
 * preset specs that exercise different corners of the grammar.
 */
import { mountAstViewer } from "./ast-view.js";

const PRESETS: Record<string, string> = {
  "Spatial": `# Spatial relationships
card-a left-of card-b 14px;
badge inside page -8px top right;
hero near logo 20px left, 12px top bottom;
`,
  "Count & visibility": `# Counts, visibility, negation
count visible card-* is >= 3;
count any tag-* is 2 to 5;

banner visible;
popover not inside footer;
`,
  "Text, CSS & size": `# Text, CSS and sizing rules
headline text starts "Welcome";
headline css font-weight is "700";

thumb width 100% of card/width;
sidebar width <= 320px;
`,
  "Alignment & groups": `# Alignment, centering, groups
group rail as header, main, footer;
@rail visible;

icon centered all inside button;
title aligned horizontally top subtitle 4px;
`,
};

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el as T;
}

async function main(): Promise<void> {
  const editorHost = byId("ast-editor");
  const treeHost = byId("ast-tree");
  const toolbarHost = byId("ast-toolbar");
  const presetHost = byId("ast-presets");

  const presetNames = Object.keys(PRESETS);
  const viewer = await mountAstViewer({
    editorHost,
    treeHost,
    toolbarHost,
    initialSpec: PRESETS[presetNames[0]],
  });

  presetNames.forEach((name, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ast-preset" + (idx === 0 ? " active" : "");
    btn.textContent = name;
    btn.addEventListener("click", () => {
      presetHost
        .querySelectorAll(".ast-preset")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      viewer.setSpec(PRESETS[name]);
    });
    presetHost.appendChild(btn);
  });

  void injectDiagrams();
}

/**
 * Inline the railroad SVGs into their cards. We fetch + inject rather than use
 * <img src> because <img>-loaded SVGs render in "static secure" mode where the
 * inlined CSS custom properties don't reliably cascade, leaving the diagrams
 * blank. Injecting the markup inline applies the SVG's own <style> the same way
 * the full grammar reference does.
 */
async function injectDiagrams(): Promise<void> {
  const cards = document.querySelectorAll<HTMLElement>(".diagram-card[data-rule]");
  await Promise.all(
    Array.from(cards).map(async (card) => {
      const rule = card.dataset.rule;
      const mount = card.querySelector<HTMLElement>(".diagram-mount");
      if (!rule || !mount) return;
      try {
        const res = await fetch(`./railroad/${rule}.svg`);
        if (!res.ok) return;
        mount.innerHTML = await res.text();
      } catch {
        /* leave the card empty if the asset can't be loaded */
      }
    }),
  );
}

void main();
