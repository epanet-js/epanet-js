#!/usr/bin/env node
// Regenerates src/generated/ from schema/change-set.fbs. See ../AGENTS.md.
//
//   pnpm --filter @epanet-js/change-set codegen
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");
const generatedDir = join(pkgRoot, "src", "generated");

const fail = (message) => {
  console.error(`codegen: ${message}`);
  process.exit(1);
};

const pinnedVersion = () => {
  const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8"));
  const pinned = pkg.dependencies?.flatbuffers;
  if (!pinned) fail("no flatbuffers dependency in package.json");
  if (!/^\d+\.\d+\.\d+$/.test(pinned)) {
    fail(
      `flatbuffers must be pinned exactly (found "${pinned}") — the compiler and the runtime move together`,
    );
  }
  return pinned;
};

// A version mismatch does not error, it silently emits code today's runtime
// decodes wrong - so it is checked here rather than trusted.
const checkCompiler = (pinned) => {
  let reported;
  try {
    reported = execFileSync("flatc", ["--version"], { encoding: "utf8" });
  } catch {
    fail(
      "flatc is not on PATH — install it from https://github.com/google/flatbuffers/releases " +
        `(version ${pinned}, matching the flatbuffers runtime)`,
    );
  }

  const found = reported.match(/(\d+\.\d+\.\d+)/)?.[1];
  if (found !== pinned) {
    fail(
      `flatc is ${found ?? reported.trim()} but the flatbuffers runtime is pinned at ${pinned}. ` +
        "They must match; install the matching release from " +
        "https://github.com/google/flatbuffers/releases",
    );
  }
  return found;
};

const tsFilesIn = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return tsFilesIn(path);
    return path.endsWith(".ts") ? [path] : [];
  });

// flatc writes `from "./thing.js"`; those extensions do not resolve in the
// importing app's bundler.
const stripJsExtensions = () => {
  let rewritten = 0;
  for (const file of tsFilesIn(generatedDir)) {
    const source = readFileSync(file, "utf8");
    const next = source.replace(
      /(from\s+['"]\.{1,2}\/[^'"]*)\.js(['"])/g,
      "$1$2",
    );
    if (next !== source) {
      writeFileSync(file, next);
      rewritten += 1;
    }
  }
  return rewritten;
};

const pinned = pinnedVersion();
const version = checkCompiler(pinned);

execFileSync("flatc", ["--ts", "-o", "src/generated", "schema/change-set.fbs"], {
  cwd: pkgRoot,
  stdio: "inherit",
});

const rewritten = stripJsExtensions();
console.log(
  `codegen: flatc ${version} → src/generated (${rewritten} file(s) had .js import extensions stripped)`,
);
