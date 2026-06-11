# @epanet-js/ui-kit

App-neutral React UI components shared across epanet-js apps.

Currently exports the selector family (`Selector`, `SelectorList`, `SearchableSelector`,
`VirtualizedSearchableSelector`, `SelectorLikeButton`), plus the small contexts they
rely on:

- `UIProvider` / `useUIConfig` — neutral UI chrome strings (search placeholder, the
  "add new value" template, "no results"); English defaults, callers feed translations.
- `SelectorPortalContainer` / `useSelectorPortalContainer` — lets a container (e.g. a
  dialog) provide the DOM node that selector popovers portal into.

## Consuming app requirements

Components are styled with Tailwind v4 utility classes and **semantic tokens**
(`bg-popover`, `text-subtle`, `border-base`, `text-size-base`, …). The package ships
those tokens as `@epanet-js/ui-kit/tokens.css`. A consuming app's stylesheet must:

```css
@import "tailwindcss";
@import "@epanet-js/ui-kit/tokens.css";          /* the design tokens */
@source "../node_modules/@epanet-js/ui-kit/src"; /* scan components for classes */
@custom-variant dark (&:where(.dark, .dark *));  /* for the dark: token overrides */
```

1. `@import` `tokens.css` **after** `tailwindcss` (the tokens reference Tailwind's
   built-in orange/red/green/blue palette).
2. Add this package's source to Tailwind's content scan (`@source`) so the utility
   classes are generated.
3. Toggle the `.dark` class for dark mode.

These components never call `useTranslate` or import app code — translations and the
portal container are injected via the providers above.
