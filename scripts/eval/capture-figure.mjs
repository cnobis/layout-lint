// Capture for the fault-detection figure: the bar page under the
// seal mutant, widget on the failing view, panel dragged clear of the
// sidebar, width rule pinned. Crop (500, 790, 2365, 1760) of the 2x shot
// becomes the fault-seal-shrink figure.
//
// Run: node scripts/eval/capture-figure.mjs <out.png>
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = 8126;
const server = spawn("npx", ["http-server", "-c-1", "-p", String(PORT), "--silent"],
  { cwd: new URL("../..", import.meta.url).pathname, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1200));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${PORT}/demo/bar/index.html`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.layoutLintAuto);
await page.evaluate(() => document.fonts.ready);
await page.addStyleTag({ content: "*{transition:none !important; animation:none !important}" });
// the seal mutant, exactly as in the study catalog
await page.addStyleTag({ content: "#limited-stamp{width:60px !important; height:60px !important}" });
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
await page.screenshot({ path: process.argv[2] ?? "/tmp/fault-seal-shrink-full.png" });
await browser.close();
server.kill();
console.log("captured (crop to (500, 790, 2365, 1760) for the figure)");
