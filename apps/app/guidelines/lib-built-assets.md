# Lib-built public assets

Some workspace libs ship a **build-time asset that must be served from this app's
`public/` root** — e.g. a Service Worker. The app
doesn't hardcode which libs those are; it auto-discovers them at build time.

## The contract

A lib that needs to emit such an asset exposes **`scripts/build-public-assets.mjs`**.
The app's [`scripts/build-lib-assets.mjs`](../scripts/build-lib-assets.mjs) — wired into the app's `prebuild` and `dev` — scans the installed `@epanet-js/*` packages and runs every one that has that script. If none do, it does nothing.

Each build script is invoked with:

- `--outdir=<served public dir>` — where to emit. The app owns this path; the lib must not assume the app's layout.
- `--asset-prefix=epanet-js-` — the **required** filename prefix (see rules below).
- `--watch` — passed in `dev` only: run an incremental watcher instead of a one-shot build, and keep running.

## Rules a build script must follow

- **Every emitted file MUST start with `--asset-prefix` (`epanet-js-`).** A single `.gitignore` rule (`/public/epanet-js-*`) then excludes them all, so there is no per-asset entry to add or forget. The runner **enforces** this on one-shot builds: a lib that emits an un-prefixed file **fails the build** (exit 1). Watch mode skips the check, but a one-shot `build` (and CI) still catches it.
- **The lib owns its filenames.** Name assets after the lib (`epanet-js-<lib>.js`) so that several libs don't collide in the shared `public/` dir.
- **A Service Worker must be emitted to the root and registered from `/`.** A worker's scope is the directory it's served from, and it must control the `/` page to intercept its requests — so it can't live in a subfolder. Keep the register URL and the emitted filename in **one source of truth** (used by both the registration and the build script).

## How multiple libs are handled

- **One-shot (`build`)**: each discovered lib runs **sequentially**; the prefix is enforced after each. A non-zero exit or an un-prefixed file stops the build.
- **Watch (`dev`)**: each lib's watcher is started **concurrently**, all under the single `libs-server` pane.

## Running it

```bash
pnpm --filter @epanet-js/app build:lib-assets          # one-shot, all libs
pnpm --filter @epanet-js/app build:lib-assets:watch    # watch (what dev runs)

# Run a single lib's build script directly (e.g. to debug it):
node <lib>/scripts/build-public-assets.mjs --outdir=<app>/public --asset-prefix=epanet-js-
```
