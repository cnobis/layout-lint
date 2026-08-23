// backstop hook: settle the page, hide the layout-lint widget so the pixel
// oracle judges the page alone, and apply the scenario's mutation on the
// test run only (backstop passes isReference to tell the runs apart)
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
