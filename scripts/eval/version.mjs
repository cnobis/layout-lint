// Provenance for the evaluation runs: which build of layout-lint produced the
// numbers in results.json. Without this the results describe "whatever was
// checked out at the time", which cannot be cited or reproduced.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const REPO_ROOT = new URL("../../", import.meta.url);

const git = (...args) => {
  try {
    return execFileSync("git", args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null; // not a git checkout, or git unavailable
  }
};

// A dirty tree means the commit alone does not describe what ran, so record it
// rather than letting the stamp imply a clean build.
// results.json is the file these runs write, so it is always modified while a
// study is in progress and would make every stamp read dirty. What the flag is
// meant to answer is whether the measured code was clean, so ignore it.
const dirty = () => {
  const status = git("status", "--porcelain");
  if (status === null) return null;
  const changed = status
    .split("\n")
    .filter((line) => line.trim() && !line.endsWith("scripts/eval/results.json"));
  return changed.length > 0;
};

export function stamp() {
  const pkg = JSON.parse(readFileSync(new URL("package.json", REPO_ROOT), "utf8"));
  return {
    version: pkg.version,
    commit: git("rev-parse", "HEAD"),
    tag: git("describe", "--tags", "--exact-match") ?? null,
    dirty: dirty(),
  };
}
