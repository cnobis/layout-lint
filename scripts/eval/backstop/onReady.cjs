// BackstopJS onReady hook for the oracle comparison.
//
// The reference run captures the unmutated page; the test run applies the
// scenario's mutation first (Backstop passes isReference to tell them apart).
// The layout-lint widget is hidden in BOTH runs (via its light-DOM host
// element, the panel itself sits in a shadow root page CSS cannot reach):
// the comparison judges the page as a pixel oracle would see it, without
// the other oracle's UI in the frame.
module.exports = async (page, scenario, viewport, isReference) => {
  await page.waitForFunction(() => !!window.layoutLintAuto, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content:
      "*{transition:none !important; animation:none !important; caret-color:transparent !important}" +
      "[data-layout-lint-widget-host]{display:none !important}",
  });
  if (!isReference && scenario.mutation) {
    if (scenario.mutation.css) await page.addStyleTag({ content: scenario.mutation.css });
    if (scenario.mutation.action) await page.evaluate(scenario.mutation.action);
  }
};
