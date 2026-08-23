# evaluation scripts

four studies over the demo pages. each driver is standalone, run them in
this order: run-mutations creates results.json and the others merge their
section into it.

    node scripts/eval/run-mutations.mjs     # targeted catalog
    node scripts/eval/run-backstop.mjs      # pixel-oracle comparison
    GALEN_BIN=<galen launcher> node scripts/eval/galen-run.mjs   # cross-runner
    node scripts/eval/capture-figure.mjs <out.png>   # screenshot a detected fault

preconditions: `npx playwright install chromium` once, and for the
cross-runner galen 2.4.4 plus a chromedriver matching the installed chrome
in `galen/`. backstop bitmaps, galen reports, and the chromedriver binary
are gitignored, rerunning regenerates them.

every driver records the build it measured in the `layoutLint` section of
results.json: package version, commit, tag if the commit carries one, and
whether the tree was dirty. run the studies from a clean checkout of a
tagged release so the numbers can be attributed to that version.
