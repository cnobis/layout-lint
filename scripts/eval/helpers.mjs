// shared plumbing for the evaluation drivers: a static file server, page
// setup, and verdict collection through the page's own monitor.
import { spawn } from "node:child_process";
import { chromium } from "playwright";

export const REPO_ROOT = new URL("../..", import.meta.url).pathname;

// serve the repository root and give the server a moment to come up
export const serve = (port) =>
  new Promise((resolve) => {
    const proc = spawn("npx", ["http-server", "-c-1", "-p", String(port), "--silent"], {
      cwd: REPO_ROOT,
      stdio: "ignore",
    });
    setTimeout(() => resolve(proc), 1200);
  });

export const launchBrowser = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  return { browser, context };
};

// load a demo page and settle it: the runtime must be up, fonts loaded, and
// transitions off so rects are end states instead of animation frames
export const openPage = async (context, url) => {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.layoutLintAuto, null, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "*{transition:none !important; animation:none !important}" });
  return page;
};

// one evaluation through the page's own monitor, reduced to plain verdicts
export const verdicts = (page) =>
  page.evaluate(async () => {
    const r = await window.layoutLintAuto.monitor.evaluateNow();
    return r.results.map((v) => ({
      element: v.element,
      relation: v.relation,
      negated: !!v.negated,
      target: v.target ?? null,
      pass: v.pass,
      reason: v.reason ?? null,
    }));
  });

// rules that passed at baseline and fail now. comparing by index is safe
// because the spec text never changes between the two evaluations
export const newlyFailing = (base, now) => {
  const failed = [];
  for (let i = 0; i < now.length; i++) {
    if (!now[i].pass && base[i] && base[i].pass) {
      const v = now[i];
      failed.push(`${v.element} ${v.negated ? "not " : ""}${v.relation}${v.target ? " " + v.target : ""}`);
    }
  }
  return failed;
};
