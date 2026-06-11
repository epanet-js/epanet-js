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
(`bg-popover`, `text-subtle`, `border-base`, `text-size-base`, …). The consuming app must:

1. Define those tokens (see `apps/app/src/styles/globals.css` / `styles/AGENTS.md`).
2. Add this package's source to Tailwind's content scan, e.g. `@source` pointing at
   `@epanet-js/ui-kit/src`, so the utility classes are generated.

These components never call `useTranslate` or import app code — translations and the
portal container are injected via the providers above.
