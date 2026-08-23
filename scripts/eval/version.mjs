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
const dirty = () => {
  const status = git("status", "--porcelain");
  return status === null ? null : status.length > 0;
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
