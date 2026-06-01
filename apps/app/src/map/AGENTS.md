# Map Architecture Guidelines

## Standard Map Architecture Patterns

### Three-Layer Data System

EPANET-JS uses a sophisticated multi-source data architecture optimized for large hydraulic networks (>10k features):

#### Core Data Sources

- **`"main-features"`** - Full hydraulic network (all assets at last import/consolidation)
  - Contains the base hydraulic network from the latest sync point
  - Static until a new import or consolidation occurs
  - Large datasets that should not be frequently updated

- **`"delta-features"`** - Features edited since last consolidation
  - Contains only assets that have changed since the last sync
  - Much smaller subset than main-features
  - Updated on each user edit/commit

- **`"ephemeral"`** - Real-time visual feedback
  - Temporary representation during active user interactions
  - Shows live changes while user is editing (dragging, drawing)
  - NOT committed to the hydraulic model
  - Can be cancelled/reverted without affecting the model

- **`"selected-features"`** - Currently selected assets
  - Updated whenever selection changes
  - Drives selection highlight layers

- **`"icons"`** - Optimized point representations with selection states
  - Pumps, valves, tanks, reservoirs
  - Rebuilt when assets or styles change

#### Additional Sources

- **`"map-overlay"`** - External overlay features (fills, lines, labels from map overlay tools)
- **`"grid"`** - Grid display features when grid mode is enabled
- **`"gis-{layerId}"`** - Dynamic pattern for custom GIS layers (shapefiles, GeoJSON, DXF)
  - Created/removed dynamically via `addGisLayersToMap()` in `state-updates.ts`

### Deck.gl Overlay System

For specialized rendering requirements that exceed Mapbox GL JS capabilities, EPANET-JS uses deck.gl overlays as a complementary rendering system. Customer points are the primary example of this pattern.

#### Why Deck.gl Overlays?

Customer points require specialized rendering that the standard source system cannot efficiently handle:

- **Scale**: 10,000 to 1,000,000+ customer points vs hundreds of hydraulic assets
- **Performance**: WebGL-optimized rendering for high-density point visualization
- **Dynamic rendering**: Zoom-based visibility and level-of-detail management
- **Specialized interactions**: Custom hover states and highlighting patterns

#### Integration Architecture

```typescript
// Customer points use deck.gl overlays instead of Mapbox sources
const customerPointsOverlay = buildCustomerPointsOverlay(customerPoints, zoom);
const ephemeralHighlightOverlay = buildCustomerPointsHighlightOverlay(highlighted, zoom);

// Combined overlay system coordinates with Mapbox layers
const combinedOverlay = [...customerPointsOverlay, ...ephemeralHighlightOverlay];
map.setOverlay(combinedOverlay);
```

#### Layer Coordination

Deck.gl overlays integrate with Mapbox layers using `beforeId` positioning:

```typescript
const scatterLayer = new ScatterplotLayer({
  id: "customer-points-layer",
  beforeId: "ephemeral-junction-highlight", // Position relative to Mapbox layers
  data: [...customerPoints.values()],
  // ... layer configuration
});
```

#### Overlay Performance Patterns

**Zoom-based Visibility:**
```typescript
const shouldShowOverlay = (zoom: number) => zoom >= 14;

// Only render customer points at appropriate zoom levels
const isVisible = shouldShowOverlay(zoom);
```

**Reference-based Updates:**
```typescript
// Use refs to prevent unnecessary overlay rebuilds
const customerPointsOverlayRef = useRef<CustomerPointsOverlay>([]);
const ephemeralDeckLayersRef = useRef<CustomerPointsOverlay>([]);

// Only rebuild when data actually changes
if (hasNewCustomerPoints) {
  customerPointsOverlayRef.current = buildCustomerPointsOverlay(data, zoom);
}
```

#### Dual Overlay System

Customer points use a two-overlay approach for optimal performance:

1. **Main Overlay** - Stable visualization of all customer points
   - `ScatterplotLayer` for point visualization
   - `LineLayer` for connection lines to pipes
   - Updated only when customer points data changes

2. **Ephemeral Highlight Overlay** - Real-time visual feedback
   - Separate layers for hover/selection highlighting
   - Updated frequently during user interactions
   - Prevents expensive rebuilds of main overlay

### Two-State Model

#### Committed State
- Features permanently saved in the hydraulic model
- Stored in `"delta-features"` (user edits since last sync) or `"main-features"` (full network at last sync)
- Persisted and permanent until explicitly changed

#### Ephemeral State
- Real-time visual feedback during user interaction
- Temporary representation in `"ephemeral"` source for hydraulic assets
- Deck.gl ephemeral overlays for customer points highlighting
- Provides immediate visual feedback without touching the underlying model
- Must be committed to become permanent

**Ephemeral State Types:**
- **Hydraulic Assets**: Use `"ephemeral"` Mapbox source for drawing, moving, editing
- **Customer Points**: Use ephemeral deck.gl overlays for hover and selection highlighting

```typescript
// Customer points ephemeral state example
type EphemeralCustomerPointsHighlight = {
  type: "customerPointsHighlight";
  customerPoints: CustomerPoint[];
};

// Triggered on hover/selection
setEphemeralState({
  type: "customerPointsHighlight",
  customerPoints: [hoveredCustomerPoint],
});
```

### State Transition Management

```typescript
// User starts interaction (mouse down, begins drag)
Committed → Ephemeral

// User completes action (mouse up, confirms edit)
Ephemeral → Committed

// User cancels (ESC, cancels action)
Ephemeral → Revert (back to original committed state)
```

#### Visibility Coordination
To prevent visual duplication, features in ephemeral state are handled differently based on their rendering system:

**Hydraulic Assets** (Mapbox sources):
```typescript
// Hide the single feature being edited (feature state is fine here — just one feature)
map.hideFeature("delta-features", featureId);
map.hideFeature("main-features", featureId);

// Show in ephemeral source at new position
updateEphemeralStateSource(map, ephemeralState, idMap);
```

**Customer Points** (deck.gl overlays):
```typescript
// Customer points use additive ephemeral overlays
// Main overlay remains visible, ephemeral highlight overlay is added
const combinedOverlay = [
  ...customerPointsOverlayRef.current,      // Main customer points
  ...ephemeralDeckLayersRef.current,        // Ephemeral highlights
];
map.setOverlay(combinedOverlay);
```

## Performance Optimization Patterns

### Dual-Source Strategy
Large networks use two sources to minimize expensive updates:
- Full network stays in `"main-features"` (only updated on import/consolidation)
- Only edited features update in `"delta-features"` (small, frequent updates)
- Prevents expensive re-rendering of entire network on each edit

### Feature State vs. Dedicated Sources

Feature state is only appropriate for changes affecting a **small number of features**. Applying feature state to many features at once (e.g., a large selection) causes severe performance degradation — the map becomes sluggish and unresponsive.

**Use feature state** for small-scale, targeted changes:
```typescript
// OK: hiding/showing a single feature being edited
map.hideFeature("main-features", featureId);
map.showFeature("main-features", featureId);
```

**Use a dedicated source** for anything that could affect many features at once:
```typescript
// Selection uses a dedicated source, not feature state
// because selections can span thousands of features
await map.setSource("selected-features", selectedFeatureCollection);
```

This is why `"selected-features"` exists as a separate source — it was previously implemented with feature state and caused noticeable performance problems with large selections. The dedicated source approach rebuilds only the small selection subset rather than touching the large `"main-features"` source.

**Rule of thumb**: if the number of affected features is bounded and small (e.g., the one or two features in `"delta-features"` being edited), feature state is fine. If it could scale with network size or user selection, use a dedicated source.

### Preserve Geometry References When Rebuilding Sources

When a source needs to be rebuilt, reuse existing geometry object references wherever possible. Mapbox can skip re-processing features whose geometry reference hasn't changed, so unnecessarily recreating geometry objects forces redundant work even when nothing visually changed.

```typescript
// BAD: spreads geometry into a new object on every rebuild — Mapbox sees it as changed
const feature = {
  ...existingFeature,
  geometry: { ...existingFeature.geometry },
};

// GOOD: reuse the same geometry reference if it hasn't changed
const feature = {
  ...existingFeature,
  geometry: existingFeature.geometry, // same reference = Mapbox can skip it
};
```

This matters most in sources that are rebuilt frequently (e.g., `"selected-features"`, `"delta-features"`) or that contain many features. Treat geometry references as stable identities — only replace them when the geometry actually changes.

### Change Detection System
The `state-updates.ts` file implements sophisticated change detection:

```typescript
const changes = detectChanges(mapState, previousMapState, map);
const {
  hasNewImport,
  hasNewEditions,
  hasNewStyles,
  hasNewSelection,
  hasNewEphemeralState,
  hasEphemeralStateReset,
  hasNewSimulation,
  hasNewSymbologyRules,
  hasNewCustomerPointsSymbology,
  hasNewDefaultColors,
  hasNewCustomerPoints,
  hasNewZoom,
  hasSyncMomentChanged,
  hasNewResults,
  hasNewMapOverlay,
} = changes;
```

Only update sources that actually need changes to prevent unnecessary re-rendering.

### Source Update Timeouts
Source updates scale with feature count to prevent UI freezing:
- < 1000 features: 2 second timeout
- < 10000 features: 5 second timeout
- 10000+ features: 10 second timeout

### Overlay Management Patterns

For high-volume datasets like customer points, deck.gl overlays provide specialized performance optimizations:

#### Zoom-based Visibility
```typescript
// Only render customer points at appropriate zoom levels
const shouldShowOverlay = (zoom: number) => zoom >= 14;

// Apply visibility to all layers in overlay
const updateOverlayVisibility = (overlay: Layer[], zoom: number) => {
  return overlay.map(layer => layer.clone({ visible: shouldShowOverlay(zoom) }));
};
```

#### Reference-based Update Strategy
```typescript
// Prevent unnecessary rebuilds with React refs
const customerPointsOverlayRef = useRef<CustomerPointsOverlay>([]);
const ephemeralDeckLayersRef = useRef<CustomerPointsOverlay>([]);

// Only rebuild when data changes, not on every render
if (hasNewCustomerPoints) {
  const overlay = buildCustomerPointsOverlay(customerPoints, zoom);
  customerPointsOverlayRef.current = overlay;
}
```

#### Dual Overlay Architecture
- **Main Overlay**: Stable visualization, rebuilt only on data changes
- **Ephemeral Overlay**: High-frequency updates for interactions
- **Combined**: Merged before setting on map to minimize rendering calls

```typescript
// Combine overlays efficiently
const combinedOverlay = [
  ...stableOverlay,    // Infrequently updated
  ...ephemeralOverlay, // Frequently updated
];
map.setOverlay(combinedOverlay);
```

## Key Architecture Files

### Core Style Configuration
- **`src/map/build-style.ts`** - **MAIN STYLE CONFIGURATION**
  - `buildStyle()` - Primary style builder and configuration
  - `defineEmptySources()` - Initializes all 7 core sources as empty GeoJSON
  - Registers all layers and sources for the map

### Data Source Management
- **`src/map/data-source/`** - **CRITICAL DATA SOURCES**
  - `types.ts` - Source name constants and type definitions
  - `buildOptimizedAssetsSource()` - Hydraulic network feature generation
  - `buildIconPointsSource()` - Point representations (pumps, valves, tanks, reservoirs)

### Layer System
- **`src/map/layers/layer.ts`** - **ALL LAYER DEFINITIONS**
  - All hydraulic asset layer configurations in one file
  - Layers for main-features and delta-features (paired per source)
  - Selection layers, icon layers, label layers, ephemeral layers

### Icon System
- **`src/map/icons/icons-sprite.ts`** - **SPRITE ATLAS BUILDER**
  - Builds complete sprite atlas from SVG icon states
  - Manages colored variants (active/green, open/gray, closed/red)
- **`src/map/icons/dynamic-icons.ts`** - **SVG GENERATION FUNCTIONS**
  - Individual SVG builders for each asset type
  - Handles state-based coloring and styling

### Core Architecture Files
- **`map-canvas.tsx`** - Main React component with Mapbox GL integration
- **`map-engine.ts`** - Mapbox wrapper with data source management
- **`state-updates.ts`** - **CRITICAL** - Change detection and optimization system

### System Overview
- Creates 7 core sources: `"main-features"`, `"delta-features"`, `"icons"`, `"selected-features"`, `"ephemeral"`, `"map-overlay"`, `"grid"`
- Dynamic GIS sources created on demand with `"gis-{layerId}"` pattern
- Icons system generates colored SVG variants and packs into sprite atlas
- Layer system handles hydraulic network visualization with paint/layout configurations

### Rendering System
- **`layers/`** - Layer configs for hydraulic assets (`layer.ts` is the main file)
- **`icons/`** - SVG sprite atlas generation
- **`symbology/`** - Advanced visualization and color mapping
- **`overlays/`** - Deck.gl overlay implementations
  - `customer-points.ts` - Customer points visualization and ephemeral highlighting

### Interaction System
- **`mode-handlers/`** - Drawing/interaction state management
- **`fuzzy-click.ts`** - Click detection and feature selection

## Implementation Guidelines

### Critical Rules
1. **Never bypass the state update system** in `state-updates.ts`
   - It prevents performance issues with large datasets
   - Always go through proper change detection

2. **Use feature state only for small-scale changes**
   - Feature state is fast for a handful of features (e.g., hiding the one feature being dragged)
   - Feature state applied to many features at once kills map fluidity — use a dedicated source instead
   - Selection uses `"selected-features"` source, not feature state, for this reason

3. **Follow existing change detection patterns**
   - Understand the impact of different change types
   - Respect the source update hierarchy and dependencies

4. **Maintain proper ephemeral state for real-time feedback**
   - Hide committed features when in ephemeral state
   - Provide immediate visual feedback without model changes

### Data Source Management
- Use `buildOptimizedAssetsSource()` for hydraulic network features
- Use `buildIconPointsSource()` for point representations (requires corresponding layer config)
- Use `buildEphemeralStateSource()` for temporary drawing states
- Never update sources directly - always go through `MapEngine.setSource()`

#### Icon Rendering Pipeline
Icons require both data source generation AND layer configuration. **Missing either step will result in icons not displaying.**

##### Complete Process for Adding New Asset Type Icons:
1. **Create Icon SVG**: Add `buildXxxSvg()` function to `src/map/icons/dynamic-icons.ts`
2. **Define Icon Types**: Add icon IDs to `IconId` type in `src/map/icons/icons-sprite.ts`
3. **Generate Icon URLs**: Add entries to `iconUrls` array using your SVG builder
4. **Update Data Source**: Add asset logic to `buildIconPointsSource()` in `src/map/data-source/icons.ts`
5. **Create Layer**: Add layer config to `src/map/layers/layer.ts` with `source: "icons"`
6. **Register**: Add layer to `src/map/build-style.ts`
7. **Test**: Write unit tests for data source and verify icon display

##### Example (CV Pipe Icons):
```typescript
// Step 4: Data source
if (asset.type === "pipe" && pipe.initialStatus === "cv") {
  // Generate icon feature with properties
}

// Step 5: Layer config
{ id: "check-valve-icons", type: "symbol", source: "icons", filter: ["all", ["==", "type", "pipe"], ["has", "icon"]] }
```

**Critical**: Icons require BOTH data generation (steps 1-4) AND layer rendering (steps 5-6). Data without layers won't display.

### Performance Requirements
- Profile any changes that affect >1k features
- Use feature state only for small, bounded changes — never for operations that scale with network or selection size
- Use dedicated sources for bulk operations (selection, symbology results, etc.)
- Implement proper visibility management to prevent visual artifacts
- Monitor instrumentation timings and respect `maxDurationMs` limits

### Mode Handler Integration
- Use existing mode handler patterns for user interactions
- Maintain proper ephemeral state updates for drawing modes
- Follow the command pattern for user actions affecting map state
- Ensure proper cleanup and state transitions

## Testing Strategy

### Integration Tests
Tests are located in `src/map/test/` and use a test map engine that simulates real Mapbox behavior.

#### Test Pattern
```typescript
// 1. Set initial state
const store = setInitialState({ mode: Mode.DRAW_JUNCTION });

// 2. Render test map
const map = await renderMap(store);

// 3. Trigger user events
await fireMapClick(map, { lng: 10, lat: 20 });

// 4. Assert map state changes
const features = getSourceFeatures(map, "delta-features");
expect(features).toHaveLength(1);
```

#### Test Helpers
- **`renderMap()`** - Creates test map with full React context
- **`fireMapClick()`**, **`fireMapMove()`** - Simulate user interactions
- **`getSourceFeatures()`** - Inspect source data
- **`matchPoint()`**, **`matchLineString()`** - Geometry assertions
- **`MapTestEngine`** - Mock that tracks sources and feature states

#### Testing Guidelines
- Use helpers from the map namespace to avoid coupling with internal implementation
- Test the full integration from user interaction to map state changes
- Focus on testing the complete user workflow, not individual functions
- Simulate real user behavior with event sequences

## When to Override

### Simple Changes
- Small bug fixes that don't affect the source system
- Minor styling updates that use existing patterns
- Feature flag additions following standard patterns

### Complex Features
- Features requiring new data sources (document the performance impact)
- Custom interaction modes (follow existing mode handler patterns)
- Advanced symbology requirements (extend existing symbology system)
- Performance optimizations (thoroughly test with large datasets)

### Never Override
- The dual-source data architecture (`main-features` + `delta-features`)
- The change detection system in `state-updates.ts`
- Feature state visibility management patterns
- Source update timeout mechanisms

## Architecture Direction

### Current Strengths
- Handles large datasets (>10k features) efficiently
- Non-destructive editing with fast undo/redo
- Real-time visual feedback during interactions
- Sophisticated change detection prevents unnecessary updates

### Future Considerations
- Viewport-based feature culling for extremely large networks
- Web Worker integration for heavy computations
- Enhanced caching strategies for symbols and sprites
- Progressive loading for massive datasets

## Integration with Mapbox GL JS

### Critical Requirements
- Always check Mapbox GL JS documentation for map-related features
- Don't rely only on TypeScript interfaces - verify behavior with Mapbox docs
- Use existing data source patterns established in the codebase
- Follow established layer visibility and styling patterns

### Common Patterns
```typescript
// Proper feature state management
map.setFeatureState({ source: "delta-features", id: featureId }, { selected: true });

// Proper source updates
await map.setSource("delta-features", featureCollection);

// Proper layer visibility
map.setLayoutProperty(layerId, "visibility", "visible");
```

Remember: The map architecture is optimized for performance with large hydraulic networks. Any changes must respect the dual-source system and change detection patterns to maintain this performance.
