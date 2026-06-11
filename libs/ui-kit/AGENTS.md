# @epanet-js/ui-kit — agent guidelines

App-neutral React components shared across epanet-js apps — the **BASE** layer
extracted out of `apps/app/src/components/`. See [`./README.md`](./README.md) for the
exported components and what a consuming app must provide.

Unlike the in-app BASE folder it grew out of, this is a standalone workspace package:
it **cannot** import app code (no `src/*` path access), so neutrality is enforced by the
package boundary rather than by convention. The broader BASE-vs-DOMAIN reasoning still
lives in [`../../apps/app/src/components/AGENTS.md`](../../apps/app/src/components/AGENTS.md);
read it when deciding whether something belongs here at all.

## Rules

### Dependency boundary
A component here may import only:
- `react`, `react-dom`
- app-neutral UI libraries already in use: `@radix-ui/*`, `lucide-react`, `clsx`,
  `@tanstack/react-virtual` (extend this list as more components migrate)
- other files inside this package

Forbidden — these make it DOMAIN, not BASE:
- app/domain concepts and types (`AssetId`, `HydraulicModel`, `NodeType`, …)
- i18n (`useTranslate`, translation keys)
- Jotai atoms, app stores, app constants, `captureError`

Adding a runtime dependency requires a one-line *"this dep is app-neutral because…"*
justification and a `package.json` entry. Pick the right bucket: leaf libraries
(`clsx`, `lucide-react`) go in `dependencies`; React and context-bearing libraries
(`react`, `react-dom`, `@radix-ui/react-popover`, `@tanstack/react-virtual`) go in
`peerDependencies` **and** `devDependencies`, so the consuming app supplies the single
instance.

### Strings are not translated here (string-purity)
No `useTranslate`, no translation keys. User-visible chrome comes from props with English
defaults, or from the `UIProvider` / `useUIConfig` config
(`searchPlaceholder`, `selectorAddNewValueTemplate`, `noResultsLabel` — English defaults
baked in). The app injects translations through the DOMAIN bridge
`apps/app/src/components/app-ui-config-provider.tsx`.

### Styling
Tailwind v4 utility classes and **semantic tokens** (`bg-popover`, `text-subtle`,
`border-base`, `text-size-*`). No hard-coded hex/oklch or raw palette literals where a
token exists. The tokens are defined in `src/tokens.css` (the `@theme` block, the
`.dark` overrides, and the `bg-base`/`border-base`/… utilities) and shipped as
`@epanet-js/ui-kit/tokens.css`. **Contract with the consumer:** `@import` that file
(after `@import "tailwindcss"`) and add this package to Tailwind's content scan via
`@source` — otherwise the classes are never generated and components render unstyled.
See [`./README.md`](./README.md) for the snippet.

### Icons
Lucide icons via the local `src/icons` wrapper (`ChevronDownIcon`, `CheckIcon`, default
size 16). No product/custom SVGs in this package — take an `icon?: ReactNode` prop instead.

### Bridge pattern — neutral props in, DOMAIN wrappers in the app
Components expose neutral props; the app's DOMAIN wrappers feed translations, state, and
DOM nodes through. **Compose, don't fork** — never copy a component to make a DOMAIN
variant. Current bridges:
- `AppUIConfigProvider` → `UIProvider` (translated chrome strings)
- `BaseDialog` → `SelectorPortalContainer` (the DOM node selector popovers portal into)

### Testing
Pure React Testing Library, no app harness. Tests run under this package's own
`vitest.config.ts` (jsdom). `vitest.setup.ts` provides what the app harness used to:
jest-dom matchers via `expect.extend(matchers)`, plus jsdom polyfills the components/Radix
need — `scrollIntoView`, `hasPointerCapture`/`setPointerCapture`/`releasePointerCapture`,
`ResizeObserver`, `matchMedia`. Add to it if a new component needs another DOM API.

## Adding a component
- App-neutral and plausibly reusable by another app (e.g. model-build) → it belongs here.
- Needs app state/domain/i18n that can't be lifted into props → keep it in
  `apps/app/src/components/` and compose a ui-kit primitive underneath.

## Next steps (roadmap)
1. **Shared Tailwind token layer — in progress (app-only).** The v4 tokens now live in
   `src/tokens.css`, shipped as `@epanet-js/ui-kit/tokens.css`; the app consumes them.
   Still to do for model-build: it's Tailwind **v3** (shadcn HSL tokens), so it needs a
   v3↔v4 reconciliation and the `dark` custom-variant before the selector renders there.
2. **Wire the selector into model-build** once the tokens are shared.
3. **Migrate more BASE components** out of the app (dialogs, form fields, tabs, lists,
   popovers, data-grid, …) — candidate list in the app's `components/AGENTS.md`.
4. **Refresh `apps/app/src/components/AGENTS.md`** to mark the selector as promoted
   (Stage B done) and point at this package.
