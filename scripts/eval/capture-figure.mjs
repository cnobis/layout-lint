// capture for the fault-detection figure: the bar page under the seal
// mutant, widget on the failing view, panel dragged clear of the sidebar,
// width rule pinned. crop (500, 790, 2365, 1760) of the 2x shot becomes the
// fault-seal-shrink figure.
//
// run: node scripts/eval/capture-figure.mjs <out.png>
import { chromium } from "playwright";
import { MUTANTS } from "./mutations.mjs";
import { serve } from "./helpers.mjs";

const PORT = 8126;
const sealMutant = MUTANTS.find((m) => m.id === "B11");

const server = await serve(PORT);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${PORT}/demo/bar/index.html`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.layoutLintAuto);
await page.evaluate(() => document.fonts.ready);
await page.addStyleTag({ content: "*{transition:none !important; animation:none !important}" });
await page.addStyleTag({ content: sealMutant.css });
await page.evaluate(async () => { await window.layoutLintAuto.monitor.evaluateNow(); });
await page.waitForTimeout(400);
await page.getByText("Failing", { exact: false }).first().click();
await page.waitForTimeout(300);
// drag the panel off the sidebar so the mutated seal stays in frame
await page.mouse.move(960, 503);
await page.mouse.down();
await page.mouse.move(400, 470, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(300);
await page.locator("text=limited-stamp width").first().click();
await page.waitForTimeout(400);
await page.mouse.move(20, 880);
await page.waitForTimeout(300);
await page.screenshot({ path: process.argv[2] ?? "capture-figure-full.png" });
await browser.close();
server.kill();
console.log("captured (crop to (500, 790, 2365, 1760) for the figure)");
