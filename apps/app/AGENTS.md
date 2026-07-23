# @epanet-js/app — agent guidelines

This is the epanet-js application. The guidance is split in two:

- **App-wide conventions** live in [`guidelines/`](./guidelines) (indexed below).
- **Module-specific rules** live in an `AGENTS.md` next to the code they govern.
  When you edit a folder, read its `AGENTS.md` first if one is present — several
  modules have one (the hydraulic model, the data-grid, the map, panels, styles,
  components, the import wizard, and others), and some carry constraints that
  routine instincts will violate.

## App-wide conventions (`guidelines/`)

| Guideline | Covers |
|---|---|
| [coding-standards.md](./guidelines/coding-standards.md) | Comments policy, naming, debug logging, code organization |
| [architecture.md](./guidelines/architecture.md) | The three-layer pattern: Command → Lib → State; directory structure |
| [persistence.md](./guidelines/persistence.md) | Schema-first persistence: validate-then-save transactions, the import exception, `changeNotApplied`, the write queue & recovery |
| [react-guidelines.md](./guidelines/react-guidelines.md) | Effects, state, component patterns, anti-patterns |
| [feature-flags.md](./guidelines/feature-flags.md) | Feature-flag system, `isXOn` / `FLAG_X` naming, rollout |
| [translation.md](./guidelines/translation.md) | i18n, number/unit localization |
| [testing.md](./guidelines/testing.md) | Test requirements and coverage |
| [accessibility.md](./guidelines/accessibility.md) | Accessibility requirements |
| [performance.md](./guidelines/performance.md) | Performance budgets and requirements |
| [ux-patterns.md](./guidelines/ux-patterns.md) | Standard and map-specific UX patterns |
| [utility-app-integration.md](./guidelines/utility-app-integration.md) | Embedding utility apps (e.g. the model builder iframe): transport, protocol, security |

## Workspace libraries

This app depends on separate workspace packages (e.g. `@epanet-js/ejsdb`, the
persistence / on-disk file-format layer, and `@epanet-js/i18n`, the shared i18n
machinery this app and the model builder both consume — see
[translation.md](./guidelines/translation.md)). Each owns its own rules — read the
`AGENTS.md` or README in that package before changing it. In particular, changing a
table, column, schema, or persisted JSON shape in the persistence layer is a
**file-format change** that can corrupt saved project files.
