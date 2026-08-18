# Performance Guidelines

## Standard Performance Requirements

### React Performance
- Avoid unnecessary re-renders
- Use React.memo for expensive components
- Implement proper dependency arrays in hooks
- Avoid creating objects/functions in render

### Map Performance
- Use existing optimized data sources
- Implement proper layer management
- Consider viewport-based rendering for large datasets
- Use sprite atlases for icons (existing system)

### Bundle Performance
- Use dynamic imports for large features
- Implement code splitting at route level
- Avoid importing entire libraries when only small parts are needed
- Monitor bundle size impact

### Runtime Performance
- Profile performance-critical paths
- Use browser DevTools for performance analysis
- Implement proper error boundaries
- Consider Web Workers for heavy computations

### Workers and buffer encoding

Heavy passes over the model (network review checks, area selection, trace) run in
workers. Do not hand a worker the model itself — the assets are class instances
wrapping GeoJSON, so a structured clone costs about as much as the work. Encode
the slice you need into flat buffers with `@epanet-js/buffers` and **transfer**
them, which moves ownership in O(1):

```typescript
await workerAPI.doWork(Comlink.transfer(data, transferablesOf(data)));
```

**Always encode as `ArrayBuffer`, never `SharedArrayBuffer`.** `SharedArrayBuffer`
requires the page to be cross-origin isolated (`Cross-Origin-Opener-Policy:
same-origin` plus `Cross-Origin-Embedder-Policy: require-corp`). The app
deliberately sets neither. Isolation was first ruled out because it broke the
Stripe payment embeds, which have since moved to the billing app; what keeps it
ruled out now is `require-corp`, which blocks every cross-origin frame and asset
that does not opt in — the model-builder iframe among them. Do not re-enable
isolation to unlock shared memory without checking each embed first.

Use `canUseWorker()` from `src/infra/worker.ts`. `canUseWorkers()` (plural)
additionally requires `"shared"`, so it is always false under this rule.

Checks that cannot be reduced to buffers — because they need live objects or rule
closures — should stay on the main thread and yield with `createTimeSlicer()`
from `src/infra/yield-to-main` rather than blocking it.

Today each feature encodes its own buffers per run, and several encode
overlapping data. The intent is to **cache encoded buffers and share them across
consumers**, keyed by model version, rather than re-encoding per check and per
feature. When adding an encoder, prefer a shape that could be reused over one
shaped narrowly to a single caller.

### Test Performance Guidelines
- **Tests are expensive** - avoid running full test suite unnecessarily
- Do not run all tests unless explicitly requested
- Be mindful when multiple Claude agents are active
- Target specific test patterns when possible: `pnpm test -- [pattern]`
- Never run tests in parallel with type checking or other expensive operations
- Follow the development workflow: types → tests → linting (sequentially)

### Memory Management
- Clean up event listeners and subscriptions
- Avoid memory leaks in map interactions
- Properly dispose of resources
- Monitor memory usage in development

### Object Creation Guidelines
- **Avoid creating objects** during read operations on assets
- Use existing public methods to access asset information instead of destructuring
- Don't access features from assets directly - use public methods
- Minimize object creation in performance-critical paths

```typescript
// Good: Use public methods for asset access
const junctionData = getJunctionProperties(junction);
const pipeLength = getPipeLength(pipe);

// Avoid: Creating objects during read operations  
const data = { ...asset.properties }; // Creates unnecessary object
const info = { id: asset.id, type: asset.type }; // Unnecessary object creation
```

### Asset Reference Guidelines
- **Avoid bidirectional asset references** - they create update cascades
- **Use lookup systems** instead of storing asset references directly
- **Model operations shouldn't update asset references** - update lookups only
- **Follow unidirectional pattern** - source stores target ID, not vice versa

```typescript
// Good: Unidirectional with lookup
customerPoint.allocatedJunctionId = "J1";  // Customer point stores junction ID
const customerPoints = customerPointsLookup.getByAssetId("J1"); // Lookup provides reverse

// Avoid: Bidirectional references
junction.customerPoints = ["CP1", "CP2"];  // Creates coupling and update cascades
customerPoint.allocatedJunctionId = "J1";  // Both directions stored
```

### Lookup Performance
- **Cache lookup results** when accessed repeatedly
- **Use Map structures** for O(1) lookup performance  
- **Build lookups once**, update incrementally
- **Prefer lookup updates** over asset property updates

```typescript
// Good: Efficient lookup pattern
const lookup = new Map<AssetId, AssetId[]>();
const getConnected = (id: AssetId) => lookup.get(id) || [];

// Avoid: Asset traversal for connections
const getConnected = (id: AssetId) => assets.filter(a => a.connectedTo === id);
```

### Network Performance
- Implement proper caching strategies
- Use request deduplication where appropriate
- Consider offline capabilities
- Optimize API request patterns

### Console Debugging
- Prepend console logs with `DEBUG` for filtering
- Remove debug logs before production
- Use proper logging levels
- Avoid excessive logging in tight loops

## Performance Budgets
- Initial load time: < 3 seconds
- Time to interactive: < 5 seconds
- Bundle size increase: < 50KB per feature
- Memory usage: Monitor and profile

## When to Override
- MVP features where optimization comes in later phases
- Prototype features requiring rapid development
- Complex features needing specialized optimization strategies
- Features with external performance constraints
- Development tools where performance is less critical

## Monitoring
- Use existing instrumentation patterns
- Monitor Core Web Vitals
- Track feature-specific performance metrics
- Set up performance regression alerts