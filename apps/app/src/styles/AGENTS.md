# Theme Tokens Guidelines

The app uses Tailwind v4's CSS-first theming. The semantic tokens themselves now
live in the shared package **`@epanet-js/ui-kit/src/tokens.css`** (declared in
`@theme` and re-defined under `.dark`), `@import`ed by `src/styles/globals.css`.
App-only vars (`--highlight-*`, `--cm-font`, cursors) still live in `globals.css`.
Use the semantic tokens — they remove the need for `dark:` variants and keep the
visual language consistent.

## Available Tokens

### Colors

| Use case | Class |
|---|---|
| Primary text | `text-default` |
| Secondary / muted text | `text-subtle` |
| Disabled text/icon | `text-disabled` |
| Accent / active text | `text-accent` |
| Page background | `bg-base` (utility) |
| Panel / sidebar background | `bg-panel` |
| Popover / dialog background | `bg-popover` |
| Hover background | `bg-base-hover` |
| Active / pressed background | `bg-base-active` |
| Default border | plain `border` (auto-applied) |
| Stronger border | `border-strong` (utility) |
| Accent border | `border-accent` |
| Info — text / background | `text-info` / `bg-info-subtle` |
| Success — text / background | `text-success` / `bg-success-subtle` |
| Warning — text / background | `text-warning` / `bg-warning-subtle` |
| Error — text / background | `text-error` / `bg-error-subtle` |

The default border color is set via a base-layer rule that applies to all
elements, so plain `border` already picks up the right color in both modes —
no class needed. Only add `border-strong` when the design wants the stronger
shade.

### Sizes

Use the semantic role, not the pixel size — heading tokens go on headings,
not anywhere that happens to be 24px.

| Token | Use for |
|---|---|
| `text-size-heading-1` | Page or dialog titles |
| `text-size-heading-2` | Section headings |
| `text-size-heading-3` | Subsection headings |
| `text-size-base` | Body text, form labels |
| `text-size-small` | Hints, captions, badges |

## Writing New Components

Use semantic tokens directly. Don't reach for raw `gray-*` / `dark:gray-*`
unless you've hit a Known Gap, in which case raise it before inventing a
one-off.

## When to Introduce a New Token

Add a token when the same use case appears 3+ times with the same intent.
Avoid one-off tokens.

To add one:

1. Define the variable in the `@theme { ... }` block in
   `@epanet-js/ui-kit/src/tokens.css`, pointing at a Tailwind palette value
   (e.g. `--color-accent-subtle: var(--color-purple-100);`).
2. Re-define it under `.dark { ... }` (same file) with the dark-mode value.
3. Add a row to the Available Tokens table above.

Custom utilities (`@utility name { ... }`, also in `tokens.css`) are only needed
when the property isn't `color` (e.g. `bg-base` sets
`background-color: var(--color-background-base)` which lives outside `@theme`
because it's the bare-`<body>` background).

## Known Gaps

These cases don't have a semantic token yet. Use the raw classes for now and
raise the gap if it's blocking you.

- **Focus rings** (`ring-purple-500`, `ring-indigo-500`) — no `ring-accent`
  token yet.
- **Accent-subtle highlights** (`bg-purple-100 dark:bg-gray-700` style
  badges) — no `bg-accent-subtle` token yet.
- **ProseMirror / CodeMirror skins** — currently use raw classes via `@apply`
  inside `globals.css`. Leave alone until the editor surfaces themselves are
  revisited.

Remove entries here as the gaps get filled.
