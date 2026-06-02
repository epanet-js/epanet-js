# hydraulic-model module

The in-memory domain model: assets (junctions, pipes, pumps, valves, …), the
operations that mutate them, topology, and the lookup systems that relate them.

## The rule that governs this whole module

References are **unidirectional**. Assets never store references to other
assets; the source stores the target's ID and a lookup answers the reverse query
(links know their nodes, nodes don't know their links; customer points know
their junction, junctions don't know their customer points). Read the
**Lookup Patterns** section below before adding any cross-asset reference.

This file inlines three areas: the hydraulic model itself, the lookup patterns,
and the customer-points system.

## ⚠️ Part of this module now lives in a workspace package

The **asset/value layer has been extracted** to `@epanet-js/hydraulic-model`
(`public/libs/hydraulic-model/`): `asset-types/*` (the asset classes + their
property/quantity types, `DefaultsSpec`), `factories/*` (`AssetFactory`,
`CustomerPointFactory`, `initializeModelFactories`), `label-manager`, `curves`,
`patterns`, `customer-points`, and `customer-points-lookup`. Import these from
the **bare package name** `@epanet-js/hydraulic-model` (single root barrel — no
subpaths; that's how every `@epanet-js/*` lib is consumed here). The guidelines
below still describe how these pieces work; only their home has changed.

Test builders (`buildJunction/Pipe/Pump/Reservoir/CustomerPoint`, `testDefaults`)
live in `@epanet-js/hydraulic-model-testing` — a **devDependency, test-only**
package; import them only from test files.

**Still in this directory** (the app side, not yet extracted): `hydraulic-model.ts`
(the `HydraulicModel` container), `model-operations/`, `mutations/`, `topology/`,
`asset-index`, `assets-geo`, `assets-map`, `demands`, `controls/`, `spatial-*`,
`curve-fitting`, and the `index.ts` barrel (which re-exports the moved symbols
from the package, so `src/hydraulic-model` imports keep working). The full
`HydraulicModelBuilder` test helper also stays here (`src/__helpers__/`) until the
remaining layers move.

When changing the asset classes, factories, curves, patterns, label manager, or
customer-point types, edit them in `public/libs/hydraulic-model/` — not here.

---

# Hydraulic Model Guidelines

This document provides comprehensive guidelines for working with the hydraulic model system in EPANET-JS. Understanding these patterns is essential for maintaining consistency when building features that interact with hydraulic network data.

## Architecture Overview

### Core Design Principles

The hydraulic model follows a **composition-based architecture** where the `HydraulicModel` acts as a container for specialized managers:

```typescript
type HydraulicModel = {
  version: string;
  assets: AssetsMap;                       // Map of asset ID to asset instance
  customerPoints: CustomerPoints;          // Map of customer point ID to instance
  customerPointsLookup: CustomerPointsLookup; // Reverse lookup by asset ID
  assetBuilder: AssetBuilder;              // Factory for creating new assets
  topology: Topology;                      // Network connectivity graph
  assetIndex: AssetIndex;                  // Index for node/link queries
  units: UnitsSpec;                        // Unit system specification
  demands: Demands;                        // Water demand data
  labelManager: LabelManager;              // Auto-label generation
  headlossFormula: HeadlossFormula;
  curves: Curves;
  controls: Controls;
  patterns: Patterns;
};
// Note: CustomerPointFactory is NOT on HydraulicModel — see Model Factories section
```

**Key Characteristics:**
- **GeoJSON foundation**: All assets are GeoJSON features with typed geometry and properties
- **Immutable operations**: Model changes return descriptions rather than mutating state
- **Type safety**: Strong typing throughout asset hierarchy and operations
- **Units awareness**: All quantities maintain associated units

## Asset System

### Asset Hierarchy

All hydraulic assets inherit from `BaseAsset` with a clear separation between nodes and links:

```
BaseAsset<T>
├── Node (Point geometry)
│   ├── Junction
│   ├── Tank  
│   └── Reservoir
└── Link (LineString geometry)
    ├── Pipe
    ├── Pump
    └── Valve
```

### Asset Structure

Each asset is a GeoJSON feature with:
- **ID**: Unique string identifier
- **Geometry**: Point (nodes) or LineString (links) 
- **Properties**: Type-specific properties + common AssetProperties
- **Units**: Associated unit specifications

```typescript
class BaseAsset<T> {
  feature: IFeature<AssetGeometry, T & AssetProperties>;
  id: AssetId;
  units: AssetUnits;
}
```

### Asset Builder Pattern

Use `AssetBuilder` for creating assets with proper defaults and validation:

```typescript
// Builder handles defaults, ID generation, and label assignment
const junction = hydraulicModel.assetBuilder.buildJunction({
  coordinates: [lng, lat],
  elevation: 100,
  // label auto-generated if not provided
});
```

**Builder Benefits:**
- Applies default values from `DefaultQuantities`
- Generates unique IDs if not provided
- Auto-assigns labels using `LabelManager`
- Validates required properties

## Model Operations

### Operation Pattern

All model changes use the `ModelOperation` pattern - pure functions that return change descriptions:

```typescript
type ModelOperation<T> = (model: HydraulicModel, data: T) => ModelMoment;

type ModelMoment = {
  note: string;           // Description of the change
  deleteAssets?: AssetId[]; // Assets to remove
  putAssets?: Asset[];      // Assets to add/update
  putDemands?: Demands;     // Demand changes
};
```

### Operation Principles

1. **Immutability**: Operations work on copies, never mutate original assets
2. **Descriptive**: Each operation includes a human-readable note
3. **Atomic**: Operations represent single logical changes
4. **Composable**: Multiple operations can be combined

Example operation:
```typescript
export const addNode: ModelOperation<InputData> = (hydraulicModel, { node }) => {
  const nodeCopy = node.copy();
  addMissingLabel(hydraulicModel.labelManager, nodeCopy);
  
  return {
    note: `Add ${node.type}`,
    putAssets: [nodeCopy],
  };
};
```

## Topology Management

The `Topology` class manages network connectivity using the ngraph library:

```typescript
class Topology {
  addLink(linkId: string, startNodeId: string, endNodeId: string): void
  getLinks(nodeId: string): string[]
  removeNode(nodeId: string): void
  removeLink(linkId: string): void
  hasLink(linkId: string): boolean
}
```

**Key Points:**
- Tracks which nodes connect to which other nodes through links
- Provides validation for network connectivity
- Maintains efficient lookup for connected assets
- Handles cleanup when assets are removed
- **Follows unidirectional pattern**: Links store node IDs, topology provides reverse lookup

## Lookup Systems Architecture

### Unidirectional Reference Pattern

The hydraulic model uses **unidirectional references** with **lookup systems** to eliminate bidirectional coupling:

```typescript
// Links store node references (unidirectional)
pipe.startNodeId = "J1";
pipe.endNodeId = "J2";

// Topology provides reverse lookup (no direct node references)
const connectedLinks = topology.getLinksForNode("J1");
```

### Customer Points Integration

Customer points follow the same pattern:

```typescript
// Customer points store junction references (unidirectional)
customerPoint.allocatedJunctionId = "J1";

// CustomerPointsLookup provides reverse access
const customerPoints = customerPointsLookup.getByAssetId("J1");
```

### Benefits of Lookup Strategy
- **No update cascades**: Connection changes don't trigger asset updates
- **Performance**: Lookups scale better than asset reference updates  
- **Isolation**: Assets remain independent and focused
- **Consistency**: Same pattern used throughout the system

## Property Management

### Generic Property System

Assets support dynamic property access with type safety:

```typescript
// Type-safe property access
junction.setProperty("elevation", 100);
const elevation = junction.getProperty("elevation");

// Property introspection
const propertyNames = junction.listProperties();
const hasElevation = junction.hasProperty("elevation");
```

### Units Integration

All quantities maintain associated units:
- Units are specified in the `UnitsSpec` 
- Asset builders apply correct units to properties
- Property values should always include unit context

## Testing Guidelines

### Test Asset Creation

Use builder helpers for consistent test assets:

```typescript
import { buildJunction, buildPipe } from "../../__helpers__/hydraulic-model-builder";

// Preferred: Use builders with minimal data
const junction = buildJunction({ id: "J1", coordinates: [1, 2] });
const pipe = buildPipe({ id: "P1", connections: { startNodeId: "J1", endNodeId: "J2" } });
```

### Labeling Conventions

Use short, clear labels in tests:
- **Junctions**: `J1`, `J2`, `J3` (not `J_1`, `junction-1`)
- **Pipes**: `P1`, `P2`, `P3` 
- **Reservoirs**: `R1`, `R2`, `R3`
- **Tanks**: `T1`, `T2`, `T3`

### Test Structure

Write focused tests with short descriptions:

```typescript
describe("Junction", () => {
  it("assigns default values", () => {
    const junction = buildJunction();
    expect(junction.elevation).toEqual(0);
    expect(junction.baseDemand).toEqual(0);
  });

  it("preserves immutability on copy", () => {
    const original = buildJunction({ elevation: 10 });
    const copy = original.copy();
    copy.setElevation(20);
    
    expect(original.elevation).toEqual(10);
    expect(copy.elevation).toEqual(20);
  });
});
```

### Immutability Testing

Always verify that operations don't mutate original assets:
- Test that `copy()` creates independent instances
- Verify operations work on copies, not originals
- Check that original state remains unchanged

## Development Patterns

### Label Management

The `LabelManager` provides auto-generation for asset labels:
- Generates sequential labels per asset type (`J-1`, `J-2`, etc.)
- Tracks used labels to avoid conflicts
- Applied automatically by `AssetBuilder` when labels are missing

### ID Generation

The `IdGenerator` interface (`src/lib/id-generator.ts`) provides unique numeric IDs for assets and customer points:
- `ConsecutiveIdsGenerator` is the default implementation, producing sequential integers
- Lives in `src/lib/` (not in `src/hydraulic-model/`) because it is generic infrastructure, not hydraulic logic
- Integrated into `AssetBuilder` for assets and `CustomerPointFactory` for customer points

### Model Factories

Stateful factories for creating model artifacts are decoupled from `HydraulicModel` and managed separately via `modelFactoriesAtom`.

#### Architecture

```
src/hydraulic-model/factories/
├── index.ts                    # ModelFactories type, initializeModelFactories()
└── customer-point-factory.ts   # CustomerPointFactory class

src/state/model-factories.ts    # modelFactoriesAtom (Jotai atom)
```

**`ModelFactories`** is a container type holding all factories:

```typescript
type ModelFactories = {
  customerPointFactory: CustomerPointFactory;
};
```

**`CustomerPointFactory`** encapsulates ID generation and coordinate rounding for customer points:

```typescript
class CustomerPointFactory {
  constructor(idGenerator: IdGenerator);
  create(coordinates: Position, label?: string): CustomerPoint;
  get totalGenerated(): number;
}
```

#### Why factories are separate from HydraulicModel

Factories hold **stateful creation concerns** (ID generation counters) that are not hydraulic logic. Keeping them out of `HydraulicModel`:
- Prevents the model type from growing with non-hydraulic responsibilities
- Allows independent initialization and lifecycle management
- Follows the same separation principle as `ModelMetadata` and `SimulationSettings`

#### State management

Factories are stored in `modelFactoriesAtom` (Jotai), initialized alongside `stagingModelAtom`:

- **On import**: `buildModel()` creates and returns factories, which flow through `parseInp()` → `import-inp` → `transactImport()` → atom
- **On new project**: `initializeModelFactories()` is called alongside `initializeHydraulicModel()`
- **Variable naming**: Use `factories` (not `modelFactories`) when passed alongside other types

```typescript
const factories = initializeModelFactories();
transactImport(hydraulicModel, factories, modelMetadata, name, simulationSettings);
```

#### Passing factories to model operations

Factories are passed to operations via the `data` argument, not by widening the `ModelOperation` signature:

```typescript
const addCustomerPoint: ModelOperation<{
  coordinates: Position;
  customerPointFactory: CustomerPointFactory;
}> = (_model, { coordinates, customerPointFactory }) => {
  const customerPoint = customerPointFactory.create(coordinates);
  return { note: "Add customer point", putCustomerPoints: [customerPoint] };
};
```

This approach:
- Avoids requiring all operation callers to subscribe to the factories atom
- Allows gradual migration — only operations that need a factory receive one
- Keeps operations that don't need factories unchanged

### Error Handling

Follow established error patterns:
- Use `captureWarning()` for non-fatal issues
- Throw descriptive errors for invalid operations
- Include context (asset IDs, property names) in error messages

### Performance Considerations

- Topology uses efficient graph data structures
- Assets maintain references, not copies of large data
- Operations return minimal change descriptions
- Property access is optimized for common patterns

## Integration Points

### With Map System

Assets integrate with the map visualization through:
- GeoJSON features for rendering
- Property-based styling (status, type, etc.)
- Coordinate updates for interactive editing

### With Simulation

The hydraulic model interfaces with simulation through:
- Asset property extraction for solver input
- Results application back to asset state
- Demand integration for time-varying scenarios

### With Import/Export

Model data flows through:
- Asset serialization to/from external formats
- Property mapping between EPANET and internal formats
- Validation during import process

## Best Practices

1. **Always use builders** for asset creation rather than constructors
2. **Copy before modifying** - never mutate assets directly
3. **Include units** when working with quantities
4. **Use topology methods** for connectivity queries
5. **Use lookup systems** instead of storing asset references
6. **Follow unidirectional reference pattern** - source stores target ID only
7. **Update lookups, not assets** in model operations for connections
8. **Test immutability** in all asset operations
9. **Follow naming patterns** for consistency
10. **Validate operations** before applying changes
11. **Use descriptive notes** in ModelMoments

This architecture ensures maintainable, testable, and extensible hydraulic network modeling while preserving data integrity and supporting complex engineering workflows.

---

# Lookup Patterns vs Direct References

## Core Principle: Unidirectional References Only

EPANET-JS uses **unidirectional references** with **lookup systems** to eliminate bidirectional coupling between assets. This architectural pattern prevents update cascades and improves performance at scale.

## The Problem with Bidirectional References

### What We Avoided
```typescript
// ANTI-PATTERN: Bidirectional references
class Junction {
  customerPoints: AssetId[];        // Junction → Customer Points
}

class CustomerPoint {
  allocatedJunctionId: AssetId;     // Customer Point → Junction
}

// Result: Updates require modifying both entities
const moveCustomerPoint = (cpId, newJunctionId) => {
  // Must update 3 entities for simple connection change
  oldJunction.removeCustomerPoint(cpId);    // Update old junction
  newJunction.addCustomerPoint(cpId);       // Update new junction  
  customerPoint.allocatedJunctionId = newJunctionId; // Update customer point
};
```

### Problems Created
- **Update cascades**: Simple changes require updating multiple assets
- **Tight coupling**: Assets become interdependent
- **Performance degradation**: Every connection change triggers asset updates
- **Complexity**: Model operations must coordinate multiple asset modifications
- **Scale issues**: With 1M+ customer points, asset updates become prohibitive
- **Error prone**: Easy to get assets out of sync

## The Solution: Lookup Systems

### Unidirectional Pattern
```typescript
// CORRECT PATTERN: Unidirectional with lookup
class CustomerPoint {
  allocatedJunctionId: AssetId;     // Only customer point stores reference
}

class Junction {
  baseDemand: number;               // No customer point references
}

class CustomerPointsLookup {
  private assetToCustomerPoints = new Map<AssetId, AssetId[]>();
  
  getByAssetId(assetId: AssetId): AssetId[] {
    return this.assetToCustomerPoints.get(assetId) || [];
  }
}
```

### Benefits Achieved
- **Isolated updates**: Only customer point + lookup change
- **No coupling**: Assets remain independent
- **Performance**: No asset updates for connection changes
- **Simplicity**: Single entity updates in model operations
- **Scale friendly**: Lookup overhead constant regardless of volume
- **Consistency**: Matches topology pattern throughout system

## Implementation Guidelines

### 1. Reference Direction Rules
```typescript
// REQUIRED: Source stores target ID
customerPoint.allocatedJunctionId = "J1";  // Customer point → Junction
pipe.startNodeId = "J1";                   // Pipe → Start Node  
pipe.endNodeId = "J2";                     // Pipe → End Node

// FORBIDDEN: Target stores source IDs
junction.customerPoints = ["CP1"];         // Junction ← Customer Points
node.connectedLinks = ["P1", "P2"];        // Node ← Connected Links
```

### 2. Lookup System Pattern
```typescript
// Standard lookup implementation
class AssociationLookup {
  private targetToSources = new Map<AssetId, AssetId[]>();
  
  add(sourceId: AssetId, targetId: AssetId): void {
    const sources = this.targetToSources.get(targetId) || [];
    sources.push(sourceId);
    this.targetToSources.set(targetId, sources);
  }
  
  remove(sourceId: AssetId, targetId: AssetId): void {
    const sources = this.targetToSources.get(targetId) || [];
    const filtered = sources.filter(id => id !== sourceId);
    this.targetToSources.set(targetId, filtered);
  }
  
  getByTargetId(targetId: AssetId): AssetId[] {
    return this.targetToSources.get(targetId) || [];
  }
}
```

### 3. Model Operation Pattern
```typescript
// CORRECT: Update lookup, not assets
const moveCustomerPoint = (cpId: AssetId, newJunctionId: AssetId) => {
  const customerPoint = model.customerPoints.get(cpId);
  const oldJunctionId = customerPoint.allocatedJunctionId;
  
  // 1. Update customer point only
  customerPoint.allocatedJunctionId = newJunctionId;
  
  // 2. Update lookup only  
  model.customerPointsLookup.moveCustomerPoint(cpId, oldJunctionId, newJunctionId);
  
  // 3. Return single asset update
  return { putAssets: [customerPoint] }; // No junction updates
};

// AVOID: Updating multiple assets
const moveCustomerPointOld = (cpId: AssetId, newJunctionId: AssetId) => {
  const customerPoint = model.customerPoints.get(cpId);
  const oldJunction = model.assets.get(customerPoint.allocatedJunctionId);
  const newJunction = model.assets.get(newJunctionId);
  
  // Multiple asset updates create complexity
  customerPoint.allocatedJunctionId = newJunctionId;
  oldJunction.removeCustomerPoint(cpId);    // Asset update
  newJunction.addCustomerPoint(cpId);       // Asset update
  
  return { putAssets: [customerPoint, oldJunction, newJunction] }; // 3 updates
};
```

## Existing Lookup Systems

### Topology Index
The topology system follows this pattern for node-link relationships:

```typescript
// Links store node references (unidirectional)
pipe.startNodeId = "J1";
pipe.endNodeId = "J2";

// Topology provides reverse lookup
const connectedLinks = topology.getLinksForNode("J1");
const connectedNodes = topology.getNodesForLink("P1");
```

### CustomerPointsLookup
Customer points follow the same pattern:

```typescript
// Customer points store junction references (unidirectional)  
customerPoint.allocatedJunctionId = "J1";

// Lookup provides reverse access
const customerPoints = customerPointsLookup.getByAssetId("J1");
```

## Implementation Rules

### 1. Asset Classes
```typescript
// REQUIRED: Assets don't store reverse references
class Junction extends Node {
  baseDemand: number;  // No customerPoints property
}

class Pipe extends Link {
  startNodeId: AssetId;  // Forward reference only
  endNodeId: AssetId;    // Forward reference only
}
```

### 2. Access Patterns
```typescript
// REQUIRED: Use lookups for reverse access
const getCustomerPointsForJunction = (junctionId: AssetId) => {
  return customerPointsLookup.getByAssetId(junctionId);
};

const getLinksForNode = (nodeId: AssetId) => {
  return topology.getLinksForNode(nodeId);
};

// FORBIDDEN: Direct asset traversal
const getCustomerPointsOld = (junctionId: AssetId) => {
  const junction = assets.get(junctionId);
  return junction.customerPoints; // Creates coupling
};
```

### 3. Model Operations
```typescript
// REQUIRED: Update lookups, not asset references
const connectCustomerPoint = (cpId: AssetId, junctionId: AssetId) => {
  const customerPoint = customerPoints.get(cpId);
  customerPoint.allocatedJunctionId = junctionId;
  
  customerPointsLookup.addCustomerPoint(cpId, junctionId); // Update lookup only
  
  return { putAssets: [customerPoint] }; // Single update
};

// FORBIDDEN: Asset reference updates
const connectCustomerPointOld = (cpId: AssetId, junctionId: AssetId) => {
  const customerPoint = customerPoints.get(cpId);
  const junction = assets.get(junctionId);
  
  customerPoint.allocatedJunctionId = junctionId;
  junction.addCustomerPoint(cpId);                      // Asset modification
  
  return { putAssets: [customerPoint, junction] };      // Multiple updates
};
```

## Benefits by Use Case

### Performance at Scale
- **Customer points**: 1M+ customer points with no asset update overhead
- **Network changes**: Topology changes don't cascade to dependent entities
- **Memory efficiency**: No redundant reference storage in assets

### Maintainability  
- **Single responsibility**: Assets focus on their core properties
- **Reduced complexity**: Model operations update single entities
- **Error prevention**: No reference synchronization issues

### System Design
- **Loose coupling**: Assets remain independent
- **Consistent patterns**: All relationships use same unidirectional approach
- **Extensibility**: Easy to add new relationship types with lookups

## Migration from Bidirectional Systems

### Step 1: Identify Bidirectional References
```typescript
// Find patterns like this
class AssetA {
  connectedBIds: AssetId[];  // A → B references
}

class AssetB {
  connectedAId: AssetId;     // B → A reference
}
```

### Step 2: Choose Reference Direction
```typescript
// Keep the direction that makes logical sense
class AssetB {
  connectedAId: AssetId;     // B knows about A (keep)
}

class AssetA {
  // Remove connectedBIds property
}
```

### Step 3: Create Lookup System
```typescript
class ABLookup {
  private aToB = new Map<AssetId, AssetId[]>();
  
  getByAId(aId: AssetId): AssetId[] {
    return this.aToB.get(aId) || [];
  }
}
```

### Step 4: Update Operations
```typescript
// Before: Update both assets
const connectAB = (aId, bId) => {
  assetA.connectedBIds.push(bId);  // Update A
  assetB.connectedAId = aId;       // Update B
  return { putAssets: [assetA, assetB] };
};

// After: Update lookup only
const connectAB = (aId, bId) => {
  assetB.connectedAId = aId;       // Update B only
  abLookup.add(bId, aId);          // Update lookup
  return { putAssets: [assetB] };  // Single update
};
```

## Common Lookup Patterns

### One-to-Many Relationships
```typescript
// One junction → Many customer points
customerPointsLookup.getByAssetId(junctionId): AssetId[]

// One node → Many links  
topology.getLinksForNode(nodeId): AssetId[]
```

### Many-to-One Relationships  
```typescript
// Many customer points → One junction
customerPoint.allocatedJunctionId: AssetId

// Many links → One node
pipe.startNodeId: AssetId
pipe.endNodeId: AssetId
```

### Complex Queries
```typescript
// Combine lookups for complex relationships
const getCustomerPointsNearPipe = (pipeId: AssetId) => {
  const nodes = topology.getNodesForLink(pipeId);
  const customerPointIds = nodes.flatMap(nodeId => 
    customerPointsLookup.getByAssetId(nodeId)
  );
  return customerPointIds.map(id => customerPoints.get(id));
};
```

## Rules Summary

### ✅ REQUIRED
1. **Unidirectional references only** - source stores target ID
2. **Use lookup systems** for reverse access
3. **Update lookups, not asset references** in model operations  
4. **Follow topology pattern** throughout the system
5. **Cache lookup results** when accessed repeatedly

### ❌ FORBIDDEN
1. **Bidirectional asset references** - creates coupling
2. **Asset-to-asset reference storage** - use lookups instead
3. **Model operations updating multiple assets** for simple connections
4. **Direct asset traversal** for finding relationships
5. **Storing redundant relationship data** in assets

This pattern ensures the EPANET-JS system remains performant and maintainable as it scales to handle millions of customer points and complex hydraulic networks.

---

# Customer Points Specification

This document defines the customer points system for EPANET-JS - a demand allocation feature that allows placing customer objects on the map and automatically distributing their demand to the nearest hydraulic network junctions.

## Overview

Customer points are **non-hydraulic objects** that exist purely for demand modeling and visualization. They are never sent to the modeling engine but serve as a convenient way to represent real-world customer locations and automatically allocate their water demand to the appropriate network junctions.

### Scale Considerations

**Customer points vastly outnumber hydraulic assets** in real-world networks:
- **Hydraulic assets**: Hundreds to thousands (junctions, pipes, pumps, valves)
- **Customer points**: **10,000 to 1,000,000+** customers in large utility networks
- **Ratio**: 100:1 to 10,000:1 customer points per junction

This fundamental scale difference drives critical architectural decisions around performance, memory management, and rendering strategies.

### Key Characteristics

- **Map-only objects**: Rendered on map but excluded from hydraulic calculations
- **Automatic snapping**: Connect to the nearest point on the closest pipe
- **Demand allocation**: Automatically assign demand to upstream or downstream junction
- **Unidirectional references**: Only customer points store asset connections, not vice versa
- **Lookup-based access**: Use `customerPointsLookup` to find customer points by asset ID
- **Dynamic updates**: Re-allocation occurs when customer points or network change
- **High volume**: Designed to handle 10k-1M+ customer points efficiently

## Technical Architecture

### CustomerPoint Class

Customer points are a new asset type separate from the hydraulic model:

```typescript
type CustomerPointProperties = {
  type: "customer-point";
  demand: number;                    // Water demand value
  connectedPipeId: AssetId;         // Pipe this point connects to
  connectionPosition: Position;      // Exact point on pipe geometry
  allocatedJunctionId: AssetId;     // Junction receiving the demand
  label: string;
  visibility?: boolean;
};

class CustomerPoint extends BaseAsset<CustomerPointProperties> {
  get demand(): number;
  get connectedPipeId(): AssetId;
  get connectionPosition(): Position;
  get allocatedJunctionId(): AssetId;
  
  updateDemand(demand: number): void;
  reallocate(pipeId: AssetId, position: Position, junctionId: AssetId): void;
}
```

### CustomerPointsLookup System

Customer points are accessed through a dedicated lookup system, eliminating bidirectional references:

```typescript
// Lookup system similar to topology
class CustomerPointsLookup {
  private assetToCustomerPoints = new Map<AssetId, AssetId[]>();
  
  getByAssetId(assetId: AssetId): AssetId[] {
    return this.assetToCustomerPoints.get(assetId) || [];
  }
  
  addCustomerPoint(customerPointId: AssetId, allocatedJunctionId: AssetId): void {
    // Update lookup without modifying junction asset
  }
  
  removeCustomerPoint(customerPointId: AssetId, allocatedJunctionId: AssetId): void {
    // Update lookup without modifying junction asset
  }
  
  moveCustomerPoint(customerPointId: AssetId, oldJunctionId: AssetId, newJunctionId: AssetId): void {
    // Update lookup without modifying junction assets
  }
}

// Junctions remain unchanged - no customer point references
type JunctionProperties = {
  type: "junction";
  baseDemand: number;               // Only direct junction demand
} & NodeProperties;

class Junction extends Node<JunctionProperties> {
  get totalDemand(): number {
    // Calculate using lookup: baseDemand + lookup.getByAssetId(this.id)
  }
}
```

## Snapping System

### Pipe Detection

Customer points automatically snap to the nearest pipe using the existing search infrastructure:

```typescript
const findNearestPipe = (
  position: Position, 
  assetsMap: AssetsMap,
  searchRadius: number = 50
): { pipeId: AssetId; connectionPoint: Position } | null => {
  // 1. Query rendered pipe features within search radius
  // 2. Calculate distance to each pipe's LineString geometry
  // 3. Return closest pipe and projected point on its geometry
};
```

### Junction Allocation Logic

Determine which junction (upstream or downstream) receives the customer point's demand:

```typescript
const allocateToJunction = (
  customerPoint: CustomerPoint,
  pipe: LinkAsset,
  hydraulicModel: HydraulicModel
): AssetId => {
  const { startNodeId, endNodeId } = pipe.connections;
  const connectionPos = customerPoint.connectionPosition;
  
  // Calculate distances along pipe geometry
  const distanceFromStart = calculateDistanceAlongPipe(pipe.coordinates, connectionPos, 0);
  const distanceFromEnd = calculateDistanceAlongPipe(pipe.coordinates, connectionPos, pipe.coordinates.length - 1);
  
  // Allocate to nearest junction
  return distanceFromStart < distanceFromEnd ? startNodeId : endNodeId;
};
```

### Distance Calculation

Use geometric projection to find the exact connection point:

```typescript
const projectPointOnPipe = (
  customerPosition: Position,
  pipeCoordinates: Position[]
): { position: Position; segmentIndex: number; distanceRatio: number } => {
  // 1. Find closest segment on pipe LineString
  // 2. Project customer point onto that segment
  // 3. Return projected position and metadata
};
```

## Operations & Workflows

### Adding Customer Points

```typescript
type AddCustomerPointData = {
  position: Position;
  demand: number;
  label?: string;
};

const addCustomerPoint: ModelOperation<AddCustomerPointData> = (
  hydraulicModel,
  { position, demand, label }
) => {
  // 1. Find nearest pipe and connection point
  const connection = findNearestPipe(position, hydraulicModel.assets);
  if (!connection) throw new Error("No nearby pipe found");
  
  // 2. Determine allocation junction
  const pipe = hydraulicModel.assets.get(connection.pipeId);
  const junctionId = allocateToJunction(customerPoint, pipe, hydraulicModel);
  
  // 3. Create customer point
  const customerPoint = hydraulicModel.assetBuilder.buildCustomerPoint({
    coordinates: position,
    demand,
    label: label || hydraulicModel.labelManager.generateFor("customer-point"),
    connectedPipeId: connection.pipeId,
    connectionPosition: connection.connectionPoint,
    allocatedJunctionId: junctionId,
  });
  
  // 4. Update lookup only - no asset modifications
  hydraulicModel.customerPointsLookup.addCustomerPoint(customerPoint.id, junctionId);
  
  return {
    note: `Add customer point with demand ${demand}`,
    putAssets: [customerPoint], // Only customer point, no junction update
  };
};
```

### Moving Customer Points

```typescript
const moveCustomerPoint: ModelOperation<{ 
  customerPointId: AssetId; 
  newPosition: Position; 
}> = (hydraulicModel, { customerPointId, newPosition }) => {
  const customerPoint = hydraulicModel.customerPoints.get(customerPointId) as CustomerPoint;
  const oldJunctionId = customerPoint.allocatedJunctionId;
  
  // 1. Find new nearest pipe and allocation
  const connection = findNearestPipe(newPosition, hydraulicModel.assets);
  const pipe = hydraulicModel.assets.get(connection.pipeId);
  const newJunctionId = allocateToJunction(customerPoint, pipe, hydraulicModel);
  
  // 2. Update customer point only
  customerPoint.reallocate(connection.pipeId, connection.connectionPoint, newJunctionId);
  customerPoint.setProperty("coordinates", newPosition);
  
  // 3. Update lookup only - no junction asset modifications
  if (oldJunctionId !== newJunctionId) {
    hydraulicModel.customerPointsLookup.moveCustomerPoint(
      customerPointId, 
      oldJunctionId, 
      newJunctionId
    );
  }
  
  return {
    note: `Move customer point ${customerPoint.label}`,
    putAssets: [customerPoint], // Only customer point, no junction updates
  };
};
```

### Deleting Customer Points

```typescript
const deleteCustomerPoint: ModelOperation<{ customerPointId: AssetId }> = (
  hydraulicModel,
  { customerPointId }
) => {
  const customerPoint = hydraulicModel.customerPoints.get(customerPointId) as CustomerPoint;
  const allocatedJunctionId = customerPoint.allocatedJunctionId;
  
  // Update lookup only - no junction asset modification
  hydraulicModel.customerPointsLookup.removeCustomerPoint(customerPointId, allocatedJunctionId);
  
  return {
    note: `Delete customer point ${customerPoint.label}`,
    deleteAssets: [customerPointId],
    putAssets: [], // No asset updates needed
  };
};
```

## Data Management

### Customer Points Map

Maintain separate collections for customer points and lookup system alongside the hydraulic model:

```typescript
type CustomerPointsMap = Map<AssetId, CustomerPoint>;

type ExtendedHydraulicModel = HydraulicModel & {
  customerPoints: CustomerPointsMap;
  customerPointsLookup: CustomerPointsLookup;  // Lookup system
  // Note: CustomerPointFactory lives in modelFactoriesAtom, not on the model
};
```

### Lookup System Integration

The lookup system provides efficient access without modifying asset structures:

```typescript
// Access customer points for a junction
const getCustomerPointsForJunction = (
  junctionId: AssetId, 
  model: ExtendedHydraulicModel
): CustomerPoint[] => {
  const customerPointIds = model.customerPointsLookup.getByAssetId(junctionId);
  return customerPointIds.map(id => model.customerPoints.get(id)).filter(Boolean);
};

// Calculate total demand including customer points
const calculateJunctionDemand = (
  junction: Junction, 
  model: ExtendedHydraulicModel
): number => {
  const customerPoints = getCustomerPointsForJunction(junction.id, model);
  const customerDemand = customerPoints.reduce((sum, cp) => sum + cp.demand, 0);
  return junction.baseDemand + customerDemand;
};
```

### Factory Pattern

Customer points are created via `CustomerPointFactory` (in `src/hydraulic-model/factories/`), which is decoupled from `HydraulicModel` and managed through `modelFactoriesAtom`. See the **Model Factories** section above for full details.

```typescript
class CustomerPointFactory {
  constructor(idGenerator: IdGenerator);
  create(coordinates: Position, label?: string): CustomerPoint;
}

// Usage in a model operation — factory is passed via the data arg
const addCustomerPoint: ModelOperation<{
  coordinates: Position;
  customerPointFactory: CustomerPointFactory;
}> = (_model, { coordinates, customerPointFactory }) => {
  const customerPoint = customerPointFactory.create(coordinates);
  return { note: "Add customer point", putCustomerPoints: [customerPoint] };
};
```

## Deck.gl Rendering Architecture

Customer points use deck.gl overlays instead of traditional Mapbox layers due to scale and performance requirements. This specialized rendering system handles 10,000 to 1,000,000+ customer points efficiently.

### Why Deck.gl Over Mapbox?

- **Scale**: Optimized for high-density point visualization (10k-1M+ points)
- **Performance**: WebGL-based rendering with zoom-based visibility management
- **Flexibility**: Custom highlighting and interaction patterns
- **Memory efficiency**: Better handling of large datasets than Mapbox sources

### Core Overlay Implementation

```typescript
// Customer points use ScatterplotLayer and LineLayer from deck.gl
import { LineLayer, ScatterplotLayer } from "@deck.gl/layers";

export const buildCustomerPointsOverlay = (
  customerPoints: CustomerPoints,
  zoom: number,
): CustomerPointsOverlay => {
  // Connection lines from customer points to pipes
  const connectionLinesLayer = new LineLayer({
    id: "customer-connection-lines-layer",
    beforeId: "imported-pipes", // Position relative to Mapbox layers
    data: connectionLines,
    getSourcePosition: (d: ConnectionLineData) => d.sourcePosition,
    getTargetPosition: (d: ConnectionLineData) => d.targetPosition,
    
    widthUnits: "meters",
    getWidth: 0.8,
    getColor: connectionLineColor,
    visible: shouldShowOverlay(zoom),
  });

  // Customer points as circles
  const scatterLayer = new ScatterplotLayer({
    id: "customer-points-layer",
    beforeId: "ephemeral-junction-highlight",
    data: [...customerPoints.values()],
    getPosition: (d: CustomerPoint) => d.coordinates,
    
    radiusUnits: "meters",
    getRadius: 1.5,
    getFillColor: fillColor,
    getLineColor: strokeColor,
    visible: shouldShowOverlay(zoom),
  });

  return [connectionLinesLayer, scatterLayer];
};
```

### Performance-Optimized Rendering

#### Zoom-based Visibility
```typescript
// Only show customer points at zoom level 14 and above
export const shouldShowOverlay = (zoom: number) => zoom >= 14;

// Apply visibility to all layers
export const updateCustomerPointsOverlayVisibility = (
  overlay: CustomerPointsOverlay,
  zoom: number,
) => {
  return overlay.map(layer => 
    layer.clone({ visible: shouldShowOverlay(zoom) })
  );
};
```

#### Layer Coordination with beforeId
Customer points layers are positioned relative to Mapbox layers using `beforeId`:

```typescript
// Position connection lines behind pipes
beforeId: "imported-pipes"

// Position customer points above junctions but below ephemeral highlighting
beforeId: "ephemeral-junction-highlight"
```

### Ephemeral State Handling

Customer points use a dedicated ephemeral state system for real-time visual feedback:

```typescript
// Ephemeral state type for customer point highlighting
export type EphemeralCustomerPointsHighlight = {
  type: "customerPointsHighlight";
  customerPoints: CustomerPoint[];
};

// Build highlight overlay for ephemeral state
export const buildCustomerPointsHighlightOverlay = (
  highlightedPoints: CustomerPoint[],
  zoom: number,
): CustomerPointsOverlay => {
  const haloLayer = new ScatterplotLayer({
    id: "customer-points-halo-layer",
    data: highlightedPoints,
    getRadius: 3,              // Larger than main points
    getFillColor: haloFillColor, // Cyan with transparency
  });

  const highlightLayer = new ScatterplotLayer({
    id: "customer-points-highlight-layer", 
    data: highlightedPoints,
    getFillColor: highlightFillColor, // Solid cyan
  });

  return [haloLayer, highlightLayer];
};
```

### Dual Overlay System

Customer points use two separate overlays for optimal performance:

1. **Main Overlay** - Stable visualization of all customer points
   - Updated only when customer point data changes
   - Contains all customer points and their connection lines
   - Expensive to rebuild, so updated infrequently

2. **Ephemeral Highlight Overlay** - Real-time visual feedback
   - Updated frequently during hover/selection interactions
   - Contains only highlighted customer points with special styling
   - Lightweight and fast to rebuild

```typescript
// Combined overlay system in state-updates.ts
const combinedOverlay = [
  ...customerPointsOverlayRef.current,     // Main overlay
  ...ephemeralDeckLayersRef.current,       // Ephemeral highlights  
];
map.setOverlay(combinedOverlay);
```

### Integration with Map State System

Customer points integrate with the existing map state management:

```typescript
// React refs prevent unnecessary rebuilds
const customerPointsOverlayRef = useRef<CustomerPointsOverlay>([]);
const ephemeralDeckLayersRef = useRef<CustomerPointsOverlay>([]);

// Only rebuild when customer points data actually changes
if (hasNewCustomerPoints) {
  const overlay = buildCustomerPointsOverlay(customerPoints, zoom);
  customerPointsOverlayRef.current = overlay;
}

// Ephemeral state triggers highlight overlay updates
if (hasNewEphemeralState && mapState.ephemeralState.type === "customerPointsHighlight") {
  const ephemeralOverlay = buildCustomerPointsHighlightOverlay(
    mapState.ephemeralState.customerPoints,
    zoom,
  );
  ephemeralDeckLayersRef.current = ephemeralOverlay;
}
```

## Simulation Integration

### Demand Aggregation

During simulation preparation, aggregate customer point demands:

```typescript
const prepareDemandData = (
  hydraulicModel: ExtendedHydraulicModel
): Map<AssetId, number> => {
  const demandMap = new Map<AssetId, number>();
  
  hydraulicModel.assets.forEach((asset) => {
    if (asset.type === "junction") {
      const junction = asset as Junction;
      let totalDemand = junction.baseDemand;
      
      // Add customer point demands
      junction.customerPoints.forEach((cpId) => {
        const customerPoint = hydraulicModel.customerPoints.get(cpId);
        if (customerPoint) {
          totalDemand += customerPoint.demand;
        }
      });
      
      demandMap.set(junction.id, totalDemand);
    }
  });
  
  return demandMap;
};
```

### Export/Import Handling

Customer points should be included in project files but excluded from EPANET export:

```typescript
const exportToEpanet = (hydraulicModel: ExtendedHydraulicModel): EpanetData => {
  // Export only hydraulic assets, customer points are pre-aggregated into junction demands
  return {
    junctions: hydraulicModel.assets
      .filter(asset => asset.type === "junction")
      .map(junction => ({
        ...junction.properties,
        baseDemand: junction.totalDemand, // Includes customer point demands
      })),
    // ... other hydraulic assets
  };
};

const exportToProject = (hydraulicModel: ExtendedHydraulicModel): ProjectData => {
  // Include both hydraulic assets and customer points for full project state
  return {
    hydraulicAssets: Array.from(hydraulicModel.assets.values()),
    customerPoints: Array.from(hydraulicModel.customerPoints.values()),
    // ... other project data
  };
};
```

## Testing Guidelines

### Unit Tests

Test core customer point functionality:

```typescript
describe("CustomerPoint", () => {
  it("creates with demand and connection info", () => {
    const cp = buildCustomerPoint({
      demand: 50,
      connectedPipeId: "P1",
      allocatedJunctionId: "J1"
    });
    
    expect(cp.demand).toBe(50);
    expect(cp.connectedPipeId).toBe("P1");
    expect(cp.allocatedJunctionId).toBe("J1");
  });
  
  it("updates allocation when moved", () => {
    const cp = buildCustomerPoint({ allocatedJunctionId: "J1" });
    cp.reallocate("P2", [1, 2], "J2");
    
    expect(cp.allocatedJunctionId).toBe("J2");
    expect(cp.connectionPosition).toEqual([1, 2]);
  });
});
```

### Integration Tests

Test customer point operations with lookup system:

```typescript
describe("Customer Point Operations", () => {
  it("adds customer point and updates lookup", () => {
    const model = buildHydraulicModel();
    const junction = buildJunction({ id: "J1" });
    const pipe = buildPipe({ 
      id: "P1", 
      connections: { startNodeId: "J1", endNodeId: "J2" }
    });
    
    const moment = addCustomerPoint(model, {
      position: [0, 0],
      demand: 100
    });
    
    expect(moment.putAssets).toHaveLength(1); // Only customer point
    const customerPointId = moment.putAssets[0].id;
    expect(model.customerPointsLookup.getByAssetId("J1")).toContain(customerPointId);
  });
  
  it("aggregates demands correctly using lookup", () => {
    const model = buildHydraulicModel();
    const junction = buildJunction({ baseDemand: 50 });
    const cp1 = buildCustomerPoint({ demand: 25, allocatedJunctionId: junction.id });
    const cp2 = buildCustomerPoint({ demand: 30, allocatedJunctionId: junction.id });
    
    model.customerPointsLookup.addCustomerPoint(cp1.id, junction.id);
    model.customerPointsLookup.addCustomerPoint(cp2.id, junction.id);
    
    const totalDemand = calculateJunctionDemand(junction, model);
    expect(totalDemand).toBe(105); // 50 + 25 + 30
  });
});
```

### Snapping Tests

Test geometric calculations:

```typescript
describe("Customer Point Snapping", () => {
  it("finds nearest pipe correctly", () => {
    const pipe = buildPipe({
      coordinates: [[0, 0], [10, 0]]
    });
    const model = buildModelWithAssets([pipe]);
    
    const result = findNearestPipe([5, 2], model.assets);
    
    expect(result.pipeId).toBe(pipe.id);
    expect(result.connectionPoint).toBeCloseTo([5, 0]);
  });
  
  it("allocates to closer junction", () => {
    const pipe = buildPipe({
      coordinates: [[0, 0], [10, 0]],
      connections: { startNodeId: "J1", endNodeId: "J2" }
    });
    
    // Customer point closer to start (J1)
    const allocation1 = allocateToJunction(
      buildCustomerPoint({ connectionPosition: [2, 0] }),
      pipe,
      model
    );
    expect(allocation1).toBe("J1");
    
    // Customer point closer to end (J2) 
    const allocation2 = allocateToJunction(
      buildCustomerPoint({ connectionPosition: [8, 0] }),
      pipe,
      model
    );
    expect(allocation2).toBe("J2");
  });
});
```

## Performance Considerations

### High-Volume Data Handling

Customer points can reach **1,000,000+ records** in large utility networks, requiring specialized performance strategies:

#### Memory Management
- Use efficient data structures (Map instead of Array for lookups)
- Implement lazy loading and data pagination for large datasets
- Consider memory pooling for frequent customer point operations
- Monitor memory usage during bulk import operations

#### Rendering Performance
- **Viewport-based rendering**: Only render customer points in current map view
- **Level-of-detail (LOD)**: Show clustered representations at low zoom levels
- **Canvas rendering**: Consider HTML5 Canvas for high-density point rendering
- **Zoom thresholds**: Hide customer points below minimum useful zoom level

#### Data Processing
- **Batch operations**: Process customer point updates in batches, not individually
- **Background processing**: Use Web Workers for heavy spatial calculations
- **Incremental updates**: Only recalculate affected areas during changes
- **Debounced operations**: Debounce rapid map interactions to prevent excessive re-renders

### Spatial Indexing

**Critical for large datasets** - implement spatial indexing for efficient nearest pipe queries:

```typescript
class SpatialPipeIndex {
  constructor(pipes: LinkAsset[]) {
    // Build R-tree or similar spatial index for O(log n) queries
    // Essential for 10k+ customer points
  }
  
  findNearestPipe(position: Position, maxDistance: number): LinkAsset | null {
    // Use spatial index for O(log n) nearest neighbor search
    // Avoid O(n) linear search with large customer point counts
  }
}
```

### Update Optimization

Batch customer point updates to minimize junction recalculations:

```typescript
const batchUpdateCustomerPoints = (
  updates: CustomerPointUpdate[],
  hydraulicModel: ExtendedHydraulicModel
): ModelMoment => {
  const affectedJunctions = new Set<AssetId>();
  const updatedAssets: Asset[] = [];
  
  updates.forEach(update => {
    // Process customer point update
    // Track affected junctions
    affectedJunctions.add(oldJunctionId);
    affectedJunctions.add(newJunctionId);
  });
  
  // Update all affected junctions once
  affectedJunctions.forEach(junctionId => {
    const junction = hydraulicModel.assets.get(junctionId);
    // Recalculate customer points list
    updatedAssets.push(junction);
  });
  
  return {
    note: `Batch update ${updates.length} customer points`,
    putAssets: updatedAssets,
  };
};
```

## Recent Implementation Updates

The customer points system has been significantly enhanced with full EPANET integration and improved architecture. This section documents the key improvements made in recent development sessions.

### EPANET Integration (Major Enhancement)

#### Customer Demands in INP Export
- **Extended `buildInp()` Function**: Added `customerDemands` option to control whether customer point demands are included in INP file generation
- **Feature Flag Integration**: When `FLAG_CUSTOMER_POINT` is enabled, simulations automatically include customer demands in the EPANET INP file
- **Demand Aggregation**: Customer point demands are now properly exported to the [DEMANDS] section of INP files
- **Simulation vs Export**: Customer demands are included during simulation execution but excluded from manual INP exports

#### Implementation Details
```typescript
// buildInp() now supports customer demands
const inp = buildInp(hydraulicModel, { customerDemands: true });

// Feature flag integration in run-simulation.tsx
const isCustomerPointOn = useFeatureFlag("FLAG_CUSTOMER_POINT");
const inp = buildInp(hydraulicModel, { customerDemands: isCustomerPointOn });
```

### Code Architecture Improvements

#### Options Object Refactoring
- **Clean Options Pattern**: Refactored `buildInp()` to use a clean options object with defaults instead of destructuring
- **Better Readability**: All options are now accessed as `opts.property` making the code more maintainable
- **Default Options**: Centralized default options object for consistency

```typescript
const defaultOptions: Required<BuildOptions> = {
  geolocation: false,
  madeBy: false,
  labelIds: false,
  customerDemands: false,
};
const opts = { ...defaultOptions, ...options };
```

#### CustomerPoints Type System
- **Type Encapsulation**: Created `CustomerPoints = Map<string, CustomerPoint>` type to hide implementation details
- **Consistent Initialization**: Added `initializeCustomerPoints()` function for object creation
- **Future-Proofing**: Can easily change underlying implementation without affecting consumers
- **Type Safety**: All Map operations work through the type alias while providing better abstraction

```typescript
export type CustomerPoints = Map<string, CustomerPoint>;
export const initializeCustomerPoints = (): CustomerPoints => {
  return new Map<string, CustomerPoint>();
};
```

### Testing Infrastructure Enhancements

#### HydraulicModelBuilder Enhancement
- **Test-Friendly API**: Added `withCustomerPoint()` method for easy test setup
- **Validation**: Ensures junctions exist before customer point assignment (throws clear error if not)
- **Fluent Interface**: Maintains builder pattern for method chaining

```typescript
const model = HydraulicModelBuilder.with()
  .aJunction("J1", { baseDemand: 50 })
  .withCustomerPoint("CP1", "J1", { demand: 25 })
  .build();
```

#### Comprehensive Test Coverage
- **Customer Demands Tests**: Added tests for all scenarios including enabled/disabled states, zero demand handling, and multiple customer points
- **Integration Tests**: Tests cover the complete workflow from customer point creation to INP export
- **Edge Cases**: Proper handling of zero demands, multiple customer points per junction, and feature flag states

### Key Files Modified

1. **`src/simulation/build-inp.ts`**
   - Core INP export functionality with customer demands support
   - Clean options object pattern with defaults

2. **`src/commands/run-simulation.tsx`**
   - Feature flag integration for automatic customer demands inclusion
   - Proper dependency management in React hooks

3. **`src/hydraulic-model/customer-points.ts`**
   - CustomerPoints type definition and initialization function
   - Centralized type management for better encapsulation

4. **`src/__helpers__/hydraulic-model-builder.ts`**
   - Enhanced test builder with customer point support
   - Validation and error handling for test scenarios

5. **`src/simulation/build-inp.test.ts`**
   - Comprehensive test suite for customer demands functionality
   - Coverage of all customer point scenarios

### Benefits Achieved

#### Complete EPANET Workflow
- **Full Integration**: Customer points now seamlessly integrate with hydraulic simulations
- **Automatic Inclusion**: Feature flag controls when customer demands are included in simulations
- **Proper Aggregation**: Customer demands are correctly aggregated and exported to INP format

#### Better Type Safety & Architecture
- **Encapsulation**: `CustomerPoints` type hides implementation details from consumers
- **Maintainability**: Can change underlying data structure without affecting dependent code
- **Consistency**: Standardized initialization and type usage across the codebase

#### Improved Developer Experience
- **Easy Testing**: Simple builder pattern for setting up customer point test scenarios
- **Clear APIs**: Well-defined interfaces with proper validation and error handling
- **Future-Proof**: Architecture supports easy extension and modification

### Migration Notes

If working with customer points in future sessions:

1. **Use CustomerPoints Type**: Import `CustomerPoints` instead of `Map<string, CustomerPoint>`
2. **Initialize with Function**: Use `initializeCustomerPoints()` instead of `new Map()`
3. **Test Builder**: Use `withCustomerPoint()` method for test setup
4. **EPANET Integration**: Customer demands are automatically included in simulations when feature flag is enabled

This implementation provides a robust foundation for customer point management while maintaining excellent performance characteristics for large-scale utility networks.

## Best Practices

### Scale-First Design
1. **Design for 1M+ records**: All algorithms and data structures must handle 10k-1M+ customer points
2. **Avoid O(n) operations**: Use spatial indexing, efficient lookups, and batched processing
3. **Memory-conscious**: Monitor memory usage, implement lazy loading, use efficient data structures
4. **Progressive rendering**: Use viewport-based rendering and level-of-detail strategies

### System Integration
5. **Separation of Concerns**: Keep customer points separate from hydraulic assets
6. **Automatic Allocation**: Always auto-assign to nearest junction, don't require manual selection
7. **Visual Feedback**: Show connection lines to make allocation clear to users
8. **Demand Transparency**: Display aggregated demands clearly in junction properties

### Data Management
9. **Validation**: Ensure customer points always connect to valid pipes and junctions
10. **Performance**: Use spatial indexing for large numbers of customer points
11. **Data Integrity**: Maintain consistency between customer points and junction lists
12. **Export Clarity**: Clearly separate project data (includes customer points) from simulation data (excludes them)

### Implementation Guidelines
13. **Batch operations**: Never process customer points individually in loops
14. **Debounce updates**: Prevent excessive recalculations during user interactions
15. **Background processing**: Use Web Workers for heavy spatial computations
16. **Incremental updates**: Only recalculate affected areas, not entire datasets

## Architectural Principles: Unidirectional References

### Why Lookup Strategy Over Bidirectional References

The customer points system uses **unidirectional references** and **lookup systems** instead of bidirectional asset references for several critical reasons:

#### Problems with Bidirectional References
- **Update cascades**: Changing customer point connection requires updating 2-4 assets
- **Coupling**: Assets become tightly coupled through direct references  
- **Performance**: Every customer point change triggers junction/pipe updates
- **Complexity**: Model operations must manage multiple asset updates
- **Scale issues**: With 10k-1M+ customer points, asset updates become prohibitive

#### Benefits of Lookup Strategy
- **Isolation**: Customer point changes only update customer point + lookup
- **Performance**: No asset updates when only connections change
- **Consistency**: Similar to topology pattern (pipes know nodes, not vice versa)
- **Simplicity**: Model operations focus on single entity updates
- **Scale**: Lookup overhead constant regardless of customer point count

### Implementation Pattern

```typescript
// Old bidirectional approach (AVOID)
class Junction {
  customerPoints: AssetId[];  // Junction tracks customer points
  addCustomerPoint(id: AssetId) { /* Update asset */ }
}

// New unidirectional approach (REQUIRED)
class Junction {
  baseDemand: number;  // No customer point references
}

class CustomerPointsLookup {
  getByAssetId(assetId: AssetId): AssetId[];  // Lookup provides connection
}
```

### Key Rules
1. **Assets never store references to customer points**
2. **Customer points store asset IDs (unidirectional)**  
3. **Use customerPointsLookup for asset → customer points queries**
4. **Model operations update lookup, not assets**
5. **Follow topology pattern: source stores target ID, not vice versa**

This customer points system provides a powerful demand modeling tool that enhances the hydraulic network without compromising the core engineering simulation capabilities.