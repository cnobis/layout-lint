# evaluation harness

Four studies over the demo pages. Each script is standalone and idempotent;
`results.json` collects every number the studies report.

Run order (each ~1–20 min, all against a clean working tree):

    node scripts/eval/run-mutations.mjs      # targeted pool  → mutants/summary
    node scripts/eval/systematic.mjs         # systematic pool → systematic.*
    node scripts/eval/run-backstop.mjs       # pixel oracle    → backstop.*
    node scripts/eval/run-backstop.mjs --survivors   # taxonomy cross-check
    node scripts/eval/galen-run.mjs          # cross-runner    → galen.*
    node scripts/eval/capture-figure.mjs     # fault-detection figure shot

Preconditions: `npx playwright install chromium` once; Galen 2.4.4 plus a
chromedriver matching the installed Chrome in `galen/` (see `galen/*.gspec`
headers for the translation policy). Backstop bitmaps, Galen reports, and
the chromedriver binary are gitignored; regenerate them by re-running.
