// backstopjs config for the oracle comparison. scenarios.json is generated
// by ../run-backstop.mjs, everything else stays at backstop defaults,
// including the 0.1 percent mismatch threshold.
const scenarios = require("./scenarios.json");
const dataDir = __dirname + "/data";

module.exports = {
  id: "layout_lint_eval",
  viewports: [{ label: "study", width: 1280, height: 900 }],
  scenarios,
  paths: {
    bitmaps_reference: dataDir + "/bitmaps_reference",
    bitmaps_test: dataDir + "/bitmaps_test",
    engine_scripts: __dirname,
    html_report: dataDir + "/html_report",
    json_report: dataDir + "/json_report",
  },
  report: ["json"],
  engine: "puppeteer",
  engineOptions: { args: ["--no-sandbox"] },
  asyncCaptureLimit: 5,
  asyncCompareLimit: 20,
};
