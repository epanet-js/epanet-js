# Components Boundary Guidelines

`apps/app/src/components/` currently holds two kinds of components: **base UI primitives** (dialogs, form fields, wizards, tabs, lists, popovers, …) and **domain components** that know about hydraulic models, simulations, assets, plans, and other product concepts.

We are separating the two so the base layer can become a shared UI kit reusable across multiple apps. The migration happens in two stages:

- **Stage A (intermediate)** — base components move into `apps/app/src/libs/ui-kit/`, still inside the app. The boundary is enforced by folder convention and an ESLint rule. No workspace package yet, no `package.json` decisions, no dep moves.
- **Stage B (later)** — promote `apps/app/src/libs/ui-kit/` to a workspace package `@epanet-js/ui-kit` at `public/libs/ui-kit/`.

Until a given file is actually moved, treat it as base-in-place under `apps/app/src/components/`. The rules below apply regardless of physical location.

## The two buckets

| | BASE | DOMAIN |
|---|---|---|
| Knows about | nothing product-specific | hydraulic models, assets, simulations, plans, feature flags, etc. |
| Target home | `apps/app/src/libs/ui-kit/` (today) → `@epanet-js/ui-kit` (later) | `apps/app/src/components/` |
| Reusable by another app | yes | no |
| Reads Jotai atoms | no | yes |
| Calls `useTranslate` | no | yes |

## Decision tree — adding a new component

Walk through these in order. The first match wins.

1. Does it need data from `src/state/*`, `src/hydraulic-model/*`, `src/commands/*`, `src/simulation/*`, `src/map/*`, `src/selection/*`, or `src/import/*`?
   → **DOMAIN**.
2. Does it call `useTranslate`, read constants like `SUPPORT_EMAIL`, or call `captureError`?
   → Either lift those out as props (then it's BASE), or it's **DOMAIN**.
3. Could a marketing site, an internal admin tool, or an unrelated future app plausibly want it?
   → **BASE**.
4. Otherwise → **DOMAIN**.

## Import allowlist (BASE components)

A BASE component may import only from:

- `react`, `react-dom`
- `@radix-ui/*`, `lucide-react`, `clsx`, `classed-components`, `formik`, `react-colorful`, `react-hot-toast`, `@tanstack/react-virtual`, `@tanstack/react-table`, `@dnd-kit/*`
- Other files inside `src/libs/ui-kit/` (and eventually `@epanet-js/ui-kit/*`)
- Its own local files

Explicitly forbidden:

- `src/state/*`, `src/hydraulic-model/*`, `src/commands/*`, `src/simulation/*`, `src/selection/*`, `src/map/*`, `src/import/*`
- `src/hooks/use-translate`, `src/infra/error-tracking`, `src/lib/constants`
- `src/components/*` (BASE never depends on DOMAIN)
- `src/icons/custom-icons/*` (custom SVGs are product-flavored)

Lucide icons are imported from `src/icons/index.tsx` today and will live in `src/libs/ui-kit/icons/` after the icons migration step.

Adding a new runtime dependency that ends up inside a BASE component requires a PR note: *"this dep is app-neutral because…"*. Keeps the eventual lib small.

## i18n rule — BASE is string-pure

Every user-visible string in a BASE component is a prop. English defaults are fine. Callers translate.

```tsx
// BASE: src/libs/ui-kit/primitives/confirm-button.tsx
type Props = {
  onConfirm: () => void;
  label?: string;          // English default — caller overrides with t("…")
};

export function ConfirmButton({ onConfirm, label = "Confirm" }: Props) {
  return <button onClick={onConfirm}>{label}</button>;
}
```

```tsx
// DOMAIN: src/components/delete-asset-button.tsx
export function DeleteAssetButton(props: { assetId: AssetId }) {
  const translate = useTranslate();
  return (
    <ConfirmButton
      onConfirm={() => deleteAsset(props.assetId)}
      label={translate("asset.delete")}
    />
  );
}
```

Translation keys are product content — they don't belong in a multi-app library.

## Styling rule

BASE components style via Tailwind utility classes and the semantic tokens defined in the [styles AGENTS.md](../styles/AGENTS.md):

- No hard-coded hex / oklch values.
- No raw `gray-500` (or any palette token) where a semantic token exists. Prefer `text-default`, `bg-panel`, `border-base`, etc.
- Dark mode flows automatically through `.dark` overrides — no `dark:` variants needed for semantic tokens.

If a needed token doesn't exist yet, follow the "When to Introduce a New Token" section of [styles AGENTS.md](../styles/AGENTS.md). Don't invent one-offs.

## Bridge pattern — composing BASE with domain data

BASE primitives expose neutral props; DOMAIN wrappers translate, fetch state, and pass the result through. **Compose, don't fork.** Never copy-paste a BASE component to make a DOMAIN variant — that defeats the whole point of the split.

```tsx
// BASE
type Option = { label: string; value: string };
export function Selector({ options, value, onChange }: { options: Option[]; value: string; onChange: (v: string) => void }) { /* … */ }

// DOMAIN wrapper
export function NodeTypeSelector(props: { value: NodeType; onChange: (v: NodeType) => void }) {
  const translate = useTranslate();
  const options = NODE_TYPES.map((t) => ({ value: t, label: translate(`nodeType.${t}`) }));
  return <Selector options={options} value={props.value} onChange={props.onChange} />;
}
```

## Icons rule

- Lucide icons used by BASE components are imported from `src/icons/index.tsx` today (will become `src/libs/ui-kit/icons/`).
- The 4 generic geometry icons currently in `src/components/icons/` (circle, line, polygon, zoom) are BASE.
- Custom SVGs in `src/icons/custom-icons/` are DOMAIN — they encode product meaning. Don't import them inside BASE; take an `icon?: ReactNode` prop instead.

## Testing rule

- BASE component tests are pure React Testing Library — no Jotai provider, no translation provider, no app harness.
- DOMAIN tests use the existing app test harness.

## Migration cheatsheet

When converting an existing component to BASE, these are the patterns to apply:

| Found in a BASE candidate | Replace with |
|---|---|
| `useTranslate` call | string prop with English default |
| `SUPPORT_EMAIL` constant | `supportEmail` prop |
| `captureError(…)` call | `onError?: (err, info) => void` prop |
| `useSetAtom(dialogAtom)` / `useAtom(…)` | matching event prop (e.g. `onClose`) |
| `src/icons/custom-icons/X` import | `icon?: ReactNode` prop |
| `Plan`, `AssetId`, `NodeType`, other domain types | generic type parameter or `string` |

## Genuinely close calls

A few existing folders deserve a note — the BASE/DOMAIN classification is judgment, not rule:

- **`auth/`** — Clerk-coupled. Stays in `src/components/`. Different consumer apps may not use Clerk.
- **`graphs/`** — uses echarts (heavy, opinionated). Goes into the UI kit but stays quarantined under its own sub-entry. Revisit if echarts becomes contested.
- **`data-grid/`** — verify columns are generic over `TData` (no `Asset` or `HydraulicModel` references in the cell types) before classifying as BASE.
- **`form/paywall.tsx`** — DOMAIN today. The locked-feature visual shell might warrant a future BASE primitive (`<LockedOverlay>`). Defer.
- **`LabelsIcon`, `VisibilityOffIcon`, `VisibilityOnIcon`, `TypeOffIcon`** used inside `elements.tsx` — confirm whether they're lucide aliases or custom SVGs. If custom, take them as `icon` props instead of importing them in BASE.

## Related guidelines

- [../styles/AGENTS.md](../styles/AGENTS.md) — the semantic token system BASE components must use for styling
- [../../guidelines/react-guidelines.md](../../guidelines/react-guidelines.md) — effect management, atom granularity, the wider React rules that apply to both buckets
- [../../guidelines/ux-patterns.md](../../guidelines/ux-patterns.md) — interaction patterns, dialog conventions, keyboard/a11y expectations
