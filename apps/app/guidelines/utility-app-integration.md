# Utility App Integration Guidelines

How to share files (`.ejsdb`, INP, or any in-browser-generated blob) between the main app at `app.epanetjs.com` and utility apps (model-builder, fire-flow, acoustic-deployment, etc.).

There are **two integration models**. Picking between them is the first design decision for any new utility, and the rest of this document is organised around that choice.

This document is **forward-looking** for protocol additions (handshake, round-trip, tab mode) and **descriptive** for what is shipped today. A current-state section calls out the existing model-builder integration and how it diverges from the targets.

---

## Choosing an integration model

| | Same-origin (Next.js rewrites) | Cross-origin (separate subdomain + `postMessage`) |
|---|---|---|
| Util served at | `app.epanetjs.com/<util-name>` (proxied via rewrite) | `utils.epanetjs.com/<util-name>` (direct) |
| Browser sees | One origin | Two origins |
| Storage sharing (OPFS, IndexedDB, localStorage) | **Shared** with main app | Isolated per origin |
| Cookies / auth | **Shared** with main app | Subdomain cookies only |
| `postMessage` origin check | Trivial (`'self'`) | Required allowlist + preview pairing |
| CSP `frame-ancestors` | `'self'` | Per-environment management |
| `BroadcastChannel`, `SharedWorker` | Available | Not available cross-origin |
| Preview-deploy pairing | Automatic via rewrite config | Per-branch env var or branch-name derivation |
| Trust boundary | **Collapsed** — util-app vulnerability = main-app vulnerability | Preserved — util-app vulnerability stays in util origin |
| Bandwidth / latency | All util traffic proxied through main app's edge | Direct to util host |
| Operational coupling | Every new util needs a rewrite entry; util redeploys take effect under main-app origin | Independent deploys |

**Decision driver: trust.**

- **Same-origin** is appropriate for utils your team owns, reviews, and is comfortable giving full access to main-app cookies, OPFS, and localStorage. It is simpler in nearly every dimension.
- **Cross-origin** is appropriate when the util cannot be fully trusted — spike POCs, third-party contributions, anything experimental — or when the util genuinely should not see main-app state.

Both models can coexist in the same project. Per-util decision, not a project-wide one.

---

# Same-origin model (rewrites)

## How it works

The main app's `next.config.js` rewrites a same-origin path to the util's actual host:

```js
rewrites: async () => [
  {
    source: "/model-builder",
    destination: "https://model-build-web-app.vercel.app/model-builder",
  },
  {
    source: "/model-builder/:path*",
    destination: "https://model-build-web-app.vercel.app/model-builder/:path*",
  },
  // ...one entry per util
],
```

The browser sees the util at `app.epanetjs.com/model-builder` regardless of where it's actually hosted. Vercel resolves the proxy at the edge.

Preview pairing is automatic if the rewrite destinations point at preview URLs as well (e.g. main-app preview rewrites to util's preview deploy via per-environment config).

NGINX reverse proxies are functionally equivalent — pick Next.js rewrites unless you need NGINX-only features (response transformation, custom caching, etc.).

## What you gain

- **Shared storage.** OPFS, IndexedDB, localStorage, sessionStorage, Cache Storage are all visible to both apps. The main-app's "open file" flow can read a file the util just wrote to OPFS, with no `postMessage` round-trip required.
- **`postMessage` becomes trivial.** Origin checks reduce to `event.origin === location.origin`. Allowlist management, preview pairing, and CSP `frame-ancestors` complexity disappear.
- **`BroadcastChannel`, `SharedWorker`, `ServiceWorker`** become available across the apps.
- **One URL for embedded and standalone.** `app.epanetjs.com/<util>` works in both contexts.

## What to watch for

1. **Trust boundary collapse (most important).** An XSS, malicious dependency, or compromised build of a same-origin util can read every cookie, OPFS file, IndexedDB record, and localStorage entry the main app has. There is no browser-level containment. Treat same-origin utils as part of the main app's security surface.
2. **Bandwidth and edge cost.** All util traffic is proxied through main-app Vercel functions/edge. Counts against main-app quotas. Vercel edge rewrites are fast; NGINX adds more latency.
3. **CSP and service-worker scoping.** The main-app's CSP must accommodate util needs (scripts, styles, fonts). Only one service worker per origin scope — util-app SWs can collide with main-app SW.
4. **Coupling.** Every new util requires a `next.config.js` rewrite entry. Util redeploys take effect under your origin without a main-app deploy, which can surprise debugging.
5. **Cookie collision.** Util-app cookies set under `app.epanetjs.com` can collide with main-app cookies of the same name. Namespace cookies set by utils (e.g. prefix with util name).

## When to use

- Long-lived, team-owned utils
- Utils that benefit from shared storage (OPFS-based file handoff is the canonical case)
- Utils whose code is reviewed alongside main-app code

## Embedding and modes (same-origin)

Iframes are still the embedding mechanism in the same-origin model — `<iframe src="/model-builder">` mounts the util inside the host. The difference is what you can do once it's mounted: the iframe and host share an origin, so they share storage and the browser does not put a security barrier between them.

You get *more* options than in the cross-origin model, not fewer:

- **`postMessage` still works** and remains a clean way to signal events between host and iframe. Origin checks reduce to `event.origin === location.origin`.
- **Direct DOM access works**: `iframe.contentWindow.document`, calling functions defined in the iframe, reading the iframe's DOM. No CORS barrier.
- **Shared storage**: OPFS, IndexedDB, localStorage, sessionStorage, cookies, `BroadcastChannel`. The iframe can write a file to OPFS and the host can read it directly — no `postMessage` round-trip needed for the bytes.
- **CSP `frame-ancestors`** is just `'self'`.

The three modes from the cross-origin model still apply:

| Mode | Same-origin form |
|---|---|
| `embed` | `<iframe src="/model-builder">` — most common |
| `tab` | `window.open("/model-builder")` — still useful for side-by-side workflows |
| standalone | User navigates to `app.epanetjs.com/<util>` directly |

A util that supports all three modes in the same-origin model uses the same `FileTransport` abstraction described under the cross-origin section — only the implementations change (origin check becomes trivial, OPFS becomes available as a transport option).

## Main app integration (same-origin)

Even in the same-origin model, file handoff must funnel into the main app's existing loaders:

- **`.ejsdb` binary** → `openProject(dbFile: File)` in [src/lib/db/commands/open-project.ts](src/lib/db/commands/open-project.ts)
- **INP text** → `importInp([inpFile], source)` via [src/commands/import-inp.tsx](src/commands/import-inp.tsx)

The handoff transport can be `postMessage` (still useful for explicit signalling), OPFS (write from util, read from main), direct DOM access on the iframe's `contentWindow`, or a navigation with a session-storage handoff. Pick the simplest one that fits.

---

# Cross-origin model (`postMessage`)

## Background

For cross-origin utils, `app.epanetjs.com` and `utils.epanetjs.com` are **different browser origins**. All origin-scoped storage is isolated between them — OPFS, IndexedDB, localStorage, sessionStorage, Cache Storage. Only cookies scoped to the parent domain (`.epanetjs.com`) are shared, and they are too small and wrong-shaped for file bytes.

This is a browser security boundary, and it is the whole reason this model exists — the same isolation that prevents data sharing is what preserves the trust boundary. File handoff between the two origins must go through an explicit cross-origin channel. The supported channel is `postMessage`.

## Supported integration modes

A cross-origin utility app must support three modes. The mode is declared by the launching context via a URL parameter and verified with a handshake.

| Mode | Transport | How main app launches it | When to use |
|---|---|---|---|
| `embed` | `postMessage` to/from `window.parent` | Mounts `<iframe src="…?mode=embed">` | Util is part of a flow inside the main app — round-trip editing |
| `tab` | `postMessage` to/from `window.opener` | `window.open("…?mode=tab")`, retains the `Window` ref | User wants the util visible alongside the main app in a separate tab |
| standalone | Browser file picker + download | User navigates to the util app URL directly | Util used independently, no main app present |

The util app must work in all three modes. The main app uses `embed` or `tab` as the UX requires.

> **Existing convention:** the model-builder util uses a boolean `?embedded=true` param instead of `?mode=embed`. New utilities should use `?mode=…` so the three-mode protocol is uniform. Migrating the model-builder is a separate task — see the current-state section below.

## Transport abstraction

The util app exposes a single interface and selects an implementation at boot:

```ts
interface FileTransport {
  handshake(): Promise<void>;
  receive(): Promise<ArrayBuffer>;
  send(bytes: ArrayBuffer): void;
}

const mode = new URLSearchParams(location.search).get("mode");
const transport: FileTransport =
  mode === "embed" ? new IframeTransport()
  : mode === "tab" ? new TabTransport()
  : new StandaloneTransport();

await transport.handshake();
```

The rest of the util app code must be **mode-agnostic** — it only talks to `transport`. Do not branch on mode outside the transport layer.

## Protocol

Both `embed` and `tab` modes use the same message shapes:

| Message | Direction | Payload |
|---|---|---|
| `util-ready` | Util → host | `{ type: "util-ready" }` — sent on boot |
| `host-ack` | Host → util | `{ type: "host-ack" }` — confirms host identity |
| `ejsdb-file` | Either direction | `{ type: "ejsdb-file", bytes: ArrayBuffer }` — transferred as a Transferable for zero-copy |

The util announces readiness on every load (including reloads). The host re-sends the file on every `util-ready` it receives.

## Security requirements

These are non-negotiable for both `embed` and `tab` modes:

1. **Validate `event.origin` on every message** on both ends, against an allowlist of expected origins. Drop unmatched messages silently.
2. **Set `Content-Security-Policy: frame-ancestors https://app.epanetjs.com`** on the util app's responses. This prevents arbitrary sites from iframing the util.
3. **Pass the file as a Transferable**: `targetWindow.postMessage(msg, targetOrigin, [bytes])`. Never use `"*"` as the target origin.
4. **Do not trust `window.parent` / `window.opener` existence alone** to detect mode — both are spoofable by any site that frames or opens you. The `mode` URL param plus the handshake is the source of truth.

### Known security gap: missing origin validation

The existing model-builder listener in [src/dialogs/model-builder-iframe.tsx](src/dialogs/model-builder-iframe.tsx) accepts messages from **any origin**. It validates only `message.data.source === "epanet-model-builder"`, which is a string anyone can include in a postMessage. Any window that holds a reference to the main app's window — including any iframe the main app ever embeds — could forge a `modelBuildComplete` message and inject an arbitrary INP file into the user's session.

**Why the string check is not enough:** `event.data` is fully controlled by the sender. The source field is convention, not provenance. Only `event.origin` is set by the browser and cannot be spoofed.

**Mitigation:** check `event.origin` against the util app's expected origin, derived from the configured util URL.

```ts
// At module scope, derived once from config:
const expectedOrigin = new URL(modelBuilderUrl).origin;
// e.g. "https://utils.epanetjs.com"

const handleMessage = (event: MessageEvent) => {
  if (event.origin !== expectedOrigin) return;
  // ...existing handling
};
```

For multiple utility apps, keep an allowlist:

```ts
const allowedOrigins = new Set([
  new URL(modelBuilderUrl).origin,
  new URL(projectionConverterUrl).origin,
  // ...
]);

if (!allowedOrigins.has(event.origin)) return;
```

**Defense-in-depth additions worth shipping with the origin check:**

- Keep the `data.source` check — it disambiguates between multiple utilities served from the same origin (`utils.epanetjs.com/model-builder` vs `utils.epanetjs.com/projection-converter` share an origin).
- Verify `event.source === iframeRef.current?.contentWindow` so messages from sibling/unrelated windows on the same origin are dropped.
- On the util-app side, set `Content-Security-Policy: frame-ancestors https://app.epanetjs.com` so other sites cannot embed and impersonate the host.
- When the main app posts to the util, always pass an explicit `targetOrigin` — never `"*"`.

## Mode-specific gotchas

### `tab` mode

- **COOP can sever `window.opener`.** The main app must use `Cross-Origin-Opener-Policy: same-origin-allow-popups` (or omit COOP) so the opener relationship survives across the cross-origin popup.
- **Do not pass `rel="noopener"`** when calling `window.open` — it nulls `window.opener` on the util side.
- **Popup blockers** — `window.open` must run inside a real user-gesture handler. Not after an `await`, not inside a `setTimeout`.
- **Lifecycle** — either tab can close independently. Both sides should detect the other dying (`window.opener.closed` polling, or a periodic ping) and degrade gracefully — e.g. the util switches to standalone UI if the host disappears.
- **Refreshing the util tab** wipes its handshake state. The protocol handles this because the util re-announces `util-ready` on every load and the host re-sends the file.

### `embed` mode

- The util app must render appropriately for being embedded (no top-level chrome, no navigation that breaks out of the iframe).
- The host must size the iframe to the content or provide explicit dimensions; the util should not try to control its own window size.
- If the host needs the modified file back, keep the iframe mounted until the round-trip completes. Unmounting destroys the channel.

### standalone mode

- No host to talk to — `receive()` opens a file picker, `send()` triggers a download.
- The util should detect this case cleanly: no `mode` param, or `mode` param present but handshake times out (e.g. 500ms).
- A handshake timeout falling back to standalone is acceptable, but prefer explicit `mode` declaration to avoid UI flicker.

## Main app integration

Handoff paths must funnel into the main app's existing loaders — do not introduce parallel ones:

- **`.ejsdb` binary** → `openProject(dbFile: File)` in [src/lib/db/commands/open-project.ts](src/lib/db/commands/open-project.ts)
- **INP text** → `importInp([inpFile], source)` via [src/commands/import-inp.tsx](src/commands/import-inp.tsx)

For dedicated handoff entry points (e.g. tab-mode landing), use a dedicated route (e.g. `/open-handoff`) so normal-mode and handoff-mode flows are not tangled on the home route.

## Development workflow

The cross-origin protocol must be exercised in development, not just in production. Localhost setups are themselves cross-origin (different ports = different origins), so the same `postMessage` channel, origin checks, and handshake apply.

### Pointing the main app at a local utility

Util URLs are env-configurable via `NEXT_PUBLIC_*` variables (see [src/global-config.ts](src/global-config.ts)). Override in `.env.local` to run against a local util:

```bash
# .env.local on the main app
NEXT_PUBLIC_MODEL_BUILDER_URL=http://localhost:3001/model-builder?mode=embed
```

Match HTTP/HTTPS schemes on both sides — an HTTPS main app embedding an HTTP iframe will be blocked as mixed content. The simplest dev setup is HTTP both sides.

### Origin allowlist in dev

The origin allowlist must include dev origins, **conditionally on environment**. Never ship localhost entries to the production allowlist.

```ts
const allowedOrigins = new Set([
  new URL(modelBuilderUrl).origin,
  ...(process.env.NODE_ENV === "development"
    ? ["http://localhost:3001", "http://localhost:3002"]
    : []),
]);
```

Prefer deriving the dev origin from the same env var the iframe `src` uses (`new URL(modelBuilderUrl).origin`) — that way there is one source of truth and the allowlist updates automatically when the URL changes.

### CSP `frame-ancestors` in dev

The util app's `Content-Security-Policy: frame-ancestors` header must include the main app's dev origin (e.g. `http://localhost:3000`) in addition to production. Without this, the iframe will refuse to render locally and the failure mode (a blank iframe with a console error) is not obvious.

### What to verify in dev

Local development is the right place to validate the protocol end-to-end. At minimum, exercise:

- **Handshake** — util posts `util-ready`, host posts `host-ack`, file flows after that
- **Reload recovery** — refreshing the util tab/iframe re-fires `util-ready`; host re-sends the file
- **Origin rejection** — point the main app at an unexpected origin and confirm messages are dropped (paste a stray `window.postMessage` from devtools to double-check)
- **Round-trip** — for embed mode with editing, send file in, edit, send back, confirm main app receives and reloads cleanly
- **Mode fallback** — open the util at its bare URL with no `mode` param and confirm it falls back to standalone (file picker / download)

### Hot reload caveats

- **Full page reload of the iframe** triggers `onLoad` and the util will re-announce `util-ready` — the protocol handles this cleanly.
- **HMR/fast-refresh inside the iframe** does *not* re-fire `onLoad` and does *not* re-announce. If you change util code and the channel goes quiet, force a full reload of the iframe before debugging the protocol.
- **HMR in the main app** can re-mount the iframe and reset the listener; the util's next `util-ready` (after the host re-mounts) restores the channel.

## Preview deploys (Vercel)

Spike branches deploy to Vercel preview URLs (e.g. `epanet-js-git-<branch>-<org>.vercel.app`). Each preview is a **new origin**, so the cross-origin protocol applies just as in production — but the origin is not known in advance, which breaks any hardcoded allowlist.

### Pairing main-app and util-app previews

A preview of the main app should point at a matching preview of the util, not at production. Two workable approaches:

1. **Per-branch env var override** (preferred for one-off spikes): set `NEXT_PUBLIC_MODEL_BUILDER_URL` on the Vercel preview deploy via the Vercel dashboard or `vercel env`. Each spike branch gets its own pairing.
2. **Branch-name convention**: if the main app and util app use matching branch names, derive the util URL from the main app's deployment context at build time:
   ```ts
   const branch = process.env.VERCEL_GIT_COMMIT_REF;
   const modelBuilderUrl =
     process.env.NEXT_PUBLIC_MODEL_BUILDER_URL ||
     (branch && process.env.VERCEL_ENV === "preview"
       ? `https://utils-git-${slugify(branch)}-<org>.vercel.app/model-builder?mode=embed`
       : "https://utils.epanetjs.com/model-builder?mode=embed");
   ```
   Production builds fall back to the canonical URL. Use `VERCEL_ENV` (`production` / `preview` / `development`) to gate the derivation.

### Origin allowlist for previews

Hardcoding preview origins does not scale. Derive them:

```ts
const allowedOrigins = new Set<string>();

allowedOrigins.add(new URL(modelBuilderUrl).origin);

if (process.env.NODE_ENV === "development") {
  allowedOrigins.add("http://localhost:3001");
}
```

This works because `modelBuilderUrl` is already env-resolved per deploy — the preview's util URL feeds the allowlist automatically. **Do not** use a broad pattern like `*.vercel.app` — that would accept messages from every Vercel project on the internet.

If a single deploy must accept multiple util previews (e.g. main app testing several utils at once), feed in a comma-separated env var:

```ts
const extraOrigins = (process.env.NEXT_PUBLIC_EXTRA_UTIL_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);
extraOrigins.forEach(o => allowedOrigins.add(o));
```

Each entry is an explicit origin — still no wildcards.

### CSP `frame-ancestors` for previews

The util app's `frame-ancestors` directive must accept the main app's preview origins. Two options:

- **Per-preview header**: emit the directive dynamically based on `VERCEL_URL` / `VERCEL_GIT_COMMIT_REF` so each util preview only allows its paired main-app preview.
- **Pattern allowlist**: `frame-ancestors https://app.epanetjs.com https://*.epanetjs-app.vercel.app` if (and only if) your Vercel project domain pattern is stable and **scoped to your project's deployments**, not all of `*.vercel.app`.

The dynamic per-preview approach is safer. Wildcards in CSP are coarse — only use them where the wildcard can match nothing outside your project.

### What to verify on a preview deploy

Previews are the right place to catch config mismatches before merging:

- The main-app preview's iframe `src` resolves to the **paired util preview**, not production
- The util preview's CSP `frame-ancestors` accepts the main-app preview's origin (open devtools, look for a CSP violation if blank)
- The main app's allowlist accepts the util preview's origin (a forged-origin smoke test is overkill here — just confirm the happy path works end-to-end)
- The handshake completes; the file round-trips if applicable

---

## Sharing context: tracking and feature flags

Applies to **both** integration models. The principle is the same in same-origin and cross-origin: **the host owns user identity, flag evaluation, and analytics; the guest proxies through it.**

### Tracking

The host is the single point of analytics. The guest does **not** initialise its own analytics SDK.

Reasons:

- One analytics session per user, not one per app — avoids double-counting and session fragmentation
- Consistent `userId` / `anonymousId` without the guest needing to know the host's identity setup
- Host-level opt-out / privacy mode applies uniformly
- Guest doesn't need its own analytics keys or SDK initialisation

The model-builder already follows this pattern: `trackUserEvent` postMessage routes to `userTracking.capture()` in [src/dialogs/model-builder-iframe.tsx](src/dialogs/model-builder-iframe.tsx). New utils should do the same.

Protocol shape:

```ts
{ type: "trackUserEvent", data: { source: "<util-name>", userEvent: UserEvent } }
```

### Feature flags

The host has already evaluated flags in the context of the logged-in user. The guest should receive flag values **at handshake time**, not re-evaluate independently.

Reasons:

- Re-evaluating in the guest can give different results (caching, timing, anonymous-id mismatch if storage isn't shared)
- The host knows which flags are relevant to which guest — guest doesn't need to know flag names independently or hold its own flag SDK credentials
- One source of truth for an experiment cohort across host + guest — important when an experiment spans the boundary

Concrete shape: extend the `host-ack` handshake with context:

```ts
{
  type: "host-ack",
  context: {
    userId: string | null,
    anonymousId: string,
    flags: { FLAG_X: boolean, FLAG_Y: boolean, /* ... */ },
    trackingEnabled: boolean,
  }
}
```

The host filters `flags` to only those the guest cares about — published as a per-util contract. Adding a new flag to a guest means updating both the host (to include it) and the guest (to consume it), which is the desired coupling.

For flag changes that happen mid-session (rare), the host can push a `context-update` message with a partial `context` patch. The guest re-renders.

### Why this still applies in the same-origin model

In same-origin, the guest *could* read the host's cookies/localStorage and bootstrap its own analytics SDK with the same session ID. Don't — the handshake pattern is preferable because:

- The contract is identical across both integration models. A guest written this way works under either model with no changes.
- It avoids coupling the guest to the host's storage layout (cookie names, localStorage keys), which is internal implementation.
- It keeps the host as the single source of truth even when shared storage makes it technically possible to bypass.

The one place same-origin helps is *bootstrapping speed*: the guest can read shared cookies for an initial identity guess and render with that while the handshake completes, avoiding a brief unauthenticated render. Optional optimisation, not a different pattern.

### Guest-side abstraction

The transport interface gains two methods, mode-agnostic:

```ts
interface FileTransport {
  // ...existing
  track(event: UserEvent): void;
  getFlag(name: string): boolean;
}
```

- `embed` / `tab`: `track` posts to host, `getFlag` reads cached context from handshake
- `standalone`: `track` is a no-op (or logs to console in dev), `getFlag` returns a configured default

The util code calls `transport.track(...)` and `transport.getFlag(...)` everywhere — never imports an analytics SDK or flag client directly.

### What not to do (context-sharing)

- **Do not initialise an analytics SDK in the guest** (same-origin or cross-origin). Always proxy through host.
- **Do not have the guest fetch feature flags independently.** The host pushes them at handshake.
- **Do not pass flag values via URL params** for anything more than a one-shot initial-render hint. URL params are stale once the page loads and don't update.
- **Do not have the guest read host cookies/localStorage directly** to derive identity in the same-origin model. Use the handshake.

---

## Current state: model-builder integration

The following describes what is shipped today. It uses the **cross-origin model** and diverges from the target protocol; treat it as legacy until migrated.

**Location:** [src/dialogs/model-builder-iframe.tsx](src/dialogs/model-builder-iframe.tsx), URL configured in [src/global-config.ts](src/global-config.ts) as `modelBuilderUrl` (defaults to `https://utils.epanetjs.com/model-builder?embedded=true`).

**Direction:** util → main only. No host → util messages, no handshake, no round-trip.

**Mode declaration:** `?embedded=true` boolean param (target convention is `?mode=embed`).

**Message envelope:** all messages are `{ type: string, data: { source: "epanet-model-builder", ... } }`. The `data.source` discriminator is checked but `event.origin` is **not** — see the security gap above.

**Messages received:**

| Type | Payload | Routed to |
|---|---|---|
| `modelBuildComplete` | `inpContent: string`, `timestamp: number` | Wrapped as a `File`, passed to `importInp` |
| `trackUserEvent` | `userEvent: UserEvent` | `userTracking.capture(userEvent)` |
| `openExternalLink` | `url: string` | `window.open(url, "_blank", "noopener,noreferrer")` |

**Payload format:** INP text (`string`), not binary bytes. No Transferables are used.

**Gating:** dialog is gated behind early-access auth via [src/commands/open-model-builder.tsx](src/commands/open-model-builder.tsx).

**Note on existing rewrites:** `next.config.js` already contains rewrites for `/model-builder`, `/fire-flow`, and `/acoustic-deployment`. These make the utils reachable at `app.epanetjs.com/<util>` but the model-builder dialog above still loads the iframe from the `utils.epanetjs.com` URL directly — so today's model-builder is cross-origin in practice even though a same-origin path exists. Pick a model deliberately per util rather than relying on whichever URL happens to be loaded.

### Migration path (when prioritised)

1. **Add the origin check** (independent of any other change — ship this first). Today's setup quietly tolerates preview deploys against production util because all messages are accepted. Once origin checks land, spike branches needing paired util previews will require explicit pairing (per-branch env var or branch-name derivation) — production-paired spikes keep working since the prod origin stays in the allowlist.
2. Introduce a `FileTransport` abstraction on the util side and consume `?mode=embed` alongside the legacy `?embedded=true`.
3. Add the handshake (`util-ready` / `host-ack`) so future tab-mode and round-trip flows work without further protocol changes.
4. When binary file handoff becomes needed (e.g. `.ejsdb`), switch to `ArrayBuffer` + Transferables.
5. **Per-util model decision**: review each util (model-builder, fire-flow, acoustic-deployment) and pick same-origin or cross-origin deliberately. Migrate the iframe `src` accordingly.

---

## What not to do

- **Do not pick the integration model by accident.** If a util has both a rewrite entry and an iframe pointing at the direct cross-origin URL, you're getting cross-origin behaviour regardless of the rewrite. Make the choice per util and use the matching URL.
- **In the cross-origin model: do not use OPFS, IndexedDB, or localStorage** to "share" files between the apps. They are per-origin and the data will not be visible across subdomains. (In the same-origin model, these are exactly the tool you want.)
- **Do not relay files through a backend** just to avoid `postMessage`. The files are in-browser-generated; a server round-trip adds latency, cost, and a new failure mode for no benefit.
- **Do not pass file bytes through URL parameters or `window.name`.** URLs have length limits; `window.name` is a known XSS sink.
- **Do not branch util-app code on mode outside the transport layer.** All mode differences live in the `FileTransport` implementations.
- **Do not put untrusted code behind a rewrite.** Same-origin = full access to main-app cookies, OPFS, and localStorage. If you would not give the code that access, do not give it your origin.
