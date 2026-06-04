// Copies the installed @sqlite.org/sqlite-wasm binary into public/vendor with a
// version-stamped filename. The wasm binary and the glue JS that loads it are a
// single ABI and must match exactly, so the served file is taken straight from
// the installed package (the lockfile is the single source of truth) rather than
// committed by hand. The version in the filename makes upgrades bust browser/CDN
// caches automatically — a stale cached binary is simply never requested again.
//
// Kept in lockstep with worker-api.ts, which resolves the same version from the
// same package.json to build the locateFile() URL.
import { createRequire } from "node:module";
import { mkdir, copyFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { version } = require("@sqlite.org/sqlite-wasm/package.json");
const src = require.resolve("@sqlite.org/sqlite-wasm/sqlite3.wasm");

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(appDir, "public", "vendor");
const outName = `sqlite3-${version}.wasm`;

await mkdir(outDir, { recursive: true });

// Drop stale versions so the folder never holds a mismatched binary.
for (const f of await readdir(outDir).catch(() => [])) {
  if (/^sqlite3-.*\.wasm$/.test(f) && f !== outName) {
    await rm(path.join(outDir, f));
  }
}

await copyFile(src, path.join(outDir, outName));
console.log(`[copy-sqlite-wasm] public/vendor/${outName}`);
