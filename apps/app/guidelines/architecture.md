# Architecture Guidelines

## Directory Structure

### Top-Level Folders

Top-level folders under `src/` represent the app's main components and layout surfaces. Each folder is a coherent slice of the UI or a primary architectural layer:

| Folder | Purpose |
|---|---|
| `panels/` | Side and bottom panel UI |
| `dialogs/` | Modal dialogs |
| `toolbar/` | Toolbar and action buttons |
| `components/` | Shared UI components used across surfaces |
| `map/` | Map rendering, layers, sources, interactions |
| `commands/` | Commands — the entry point for all user-initiated actions |
| `hooks/` | React hooks that glue React with commands or `lib` code |
| `lib/` | "Backend-like" logic with no React dependency |
| `state/` | Jotai atoms and derived state |
| `providers/` | React context providers |

### The Three-Layer Pattern

**Commands** are the entry point for any action that changes application state. They orchestrate calls into `lib` and dispatch state updates. UI components should not call `lib` directly — they go through a command.

**Hooks** bridge React and the rest of the app. A hook may call a command, subscribe to atoms, or wrap `lib` utilities in a React-friendly API. Hooks belong in `hooks/` when they are reused across surfaces; co-locate them with the component otherwise.

**Lib** contains logic that has no dependency on React — pure functions, data transformations, model operations, API clients, workers. If it could run in a Node script or a web worker, it belongs in `lib/`.

```
User interaction
  → Component (UI only, no business logic)
  → Command (orchestrates the action)
  → Lib (pure logic, no React)
  → State (atoms updated, UI re-renders)
```

### Rules

- UI components may call `lib/` utility functions and import types freely — `lib/` is a general-purpose library, not a restricted core
- User-initiated actions that change application state should go through a command, not be inlined in a component or hook
- `lib/` should avoid importing from React or Jotai; the `persistence/` layer is a known exception as it is legitimately React-coupled — see [persistence.md](./persistence.md) for the schema-first validate-then-save pattern those hooks follow
- Commands must not render JSX
- Hooks are the glue layer — they may call lib functions, commands, and read atoms; keep orchestration logic in commands rather than hooks where possible
- New features that span multiple surfaces belong under the relevant top-level folder, not buried inside `components/`

---

## Standard Component Architecture

### React Patterns
- Avoid `useEffect` when possible
- Use callbacks for user actions instead of effects
- Use Jotai atoms for state management
- Follow existing command patterns in `src/commands/`

### File Organization
- Avoid leaking library names to project folders
- Follow existing patterns in `src/components/`
- Use helper functions in `__helpers__/` directories
- Keep related tests next to implementation files

### State Management
- Use Jotai atoms for global state
- Local state for component-specific data
- Commands pattern for user actions

### Component Structure
```typescript
// Standard component pattern
export const FeatureComponent = () => {
  const isFeatureOn = useFeatureFlag("FLAG_FEATURE");
  const handleAction = useCallback(() => {
    // Handle user action with state updates
  }, []);

  if (!isFeatureOn) return null;

  return <div>Component content</div>;
};
```

### Data Flow
- User actions → Commands → State updates → UI updates
- Avoid complex effect chains
- Use atoms for cross-component communication

### Data Access Patterns

### Lookup Strategy (Required)
- **Use lookup systems** instead of direct asset references
- **Unidirectional references only** - assets don't store references to other assets
- **No bidirectional bindings** - they create update cascades and coupling
- Follow topology pattern: links know nodes, nodes don't know links

### Lookup Systems
```typescript
// Good: Lookup-based access
const customerPoints = customerPointsLookup.getByAssetId(junctionId);
const connectedLinks = topology.getLinksForNode(nodeId);

// Avoid: Direct asset references
const customerPointIds = junction.customerPoints; // Creates coupling
const connectedLinkIds = node.connectedLinks;    // Bidirectional binding
```

### Asset Reference Rules
- **Assets must not reference other assets directly**
- **Customer points must not be referenced directly by assets**
- **Only reference by ID through lookup systems**
- **Model operations shouldn't update asset references**

## Integration Points
- Map components integrate with Mapbox GL JS
- Check Mapbox documentation for map-related features
- Use existing data source patterns in `src/map/data-source/`

## When to Override
- Complex integrations requiring non-standard patterns
- Performance-critical sections needing optimization
- External library integrations with specific requirements
- Micro-frontend architecture for complex features
- Legacy code maintenance requiring different patterns

## Code Quality
- Follow TypeScript strict mode
- Use existing utility functions
- Maintain consistent naming conventions
- Document complex business logic