// Builds the public assets contributed by workspace libs into this app's served
// public/ dir.
//
// Discovery, not a hardcoded list: scan the installed @epanet-js/* packages and
// run every `scripts/build-public-assets.mjs` one exposes. Private libs are the
// ones that carry it, so this synced runner names NONE of them — and stays a
// no-op in OSS, where no such lib was synced:
//
//   - Internal build: @epanet-js/map-tiles (or any future lib) exposes the build
//     script -> it emits its bundle(s) into this app's public/ dir.
//   - OSS build: no installed lib exposes it -> nothing to build. Exit 0
//     (one-shot) or stay alive idle (--watch), so `concurrently -k` in `dev`
//     does not tear down `next dev`.
//
// Each lib owns what it emits and under which filename, with one rule: every
// emitted file MUST start with LIB_ASSET_PREFIX. A single generic .gitignore rule
// (/public/epanet-js-*) then keeps them all out of git — no per-asset entry to add
// or forget. One-shot builds enforce the prefix so a slip fails loudly instead of
// silently committing a bundle. The prefix is passed to each lib as --asset-prefix.
import { readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

const LIB_ASSET_PREFIX = "epanet-js-";

const here = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");
const servedDir = path.resolve(here, "../public");
const scopeDir = path.resolve(here, "../node_modules/@epanet-js");

const listing = (dir) => {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
};

// Discover installed @epanet-js/* libs that publish a public-assets build.
const builders = listing(scopeDir)
  .map((name) => path.join(scopeDir, name, "scripts/build-public-assets.mjs"))
  .filter((script) => existsSync(script));

const buildArgs = (script, extra = []) => [
  script,
  `--outdir=${servedDir}`,
  `--asset-prefix=${LIB_ASSET_PREFIX}`,
  ...extra,
];

if (builders.length === 0) {
  // Stay alive in --watch so `concurrently -k` doesn't tear down `next dev`.
  if (watch) process.stdin.resume();
  else process.exit(0);
} else if (watch) {
  for (const script of builders) {
    spawn("node", buildArgs(script, ["--watch"]), { stdio: "inherit" });
  }
  process.stdin.resume(); // keep alive while the watchers run
} else {
  for (const script of builders) {
    const before = new Set(listing(servedDir));
    const res = spawnSync("node", buildArgs(script), { stdio: "inherit" });
    if (res.status) process.exit(res.status);

    // Enforce the prefix on whatever this lib just emitted.
    const stray = listing(servedDir).filter(
      (f) => !before.has(f) && !f.startsWith(LIB_ASSET_PREFIX),
    );
    if (stray.length > 0) {
      const lib = path.basename(path.dirname(path.dirname(script)));
      // eslint-disable-next-line no-console
      console.error(
        `[build-lib-assets] @epanet-js/${lib} emitted un-prefixed asset(s): ` +
          `${stray.join(", ")}.\nLib-built public assets must start with ` +
          `"${LIB_ASSET_PREFIX}" so /public/${LIB_ASSET_PREFIX}* keeps them out of git.`,
      );
      process.exit(1);
    }
  }
  process.exit(0);
}
