# @epanet-js/geometry

GeoJSON and coordinate helpers shared across the epanet-js apps and libraries —
bounding-box math, coordinate parsing/formatting, point-on-line queries, and
geometry clean-up.

It is a **no-build source package** — the `.ts` is consumed directly by the
importing app's bundler (the same convention as the other `@epanet-js/*`
workspace libraries). It uses standard `geojson` types at its boundary, so the
app's own GeoJSON aliases pass straight through.

## What you can do with it

Import functions from the package root (`@epanet-js/geometry`):

- **Coordinates** — `parseCoordinates` / `parseBBOX` (string → `Either<…>`),
  `formatCoordinates`, `roundCoordinates`, `e6` / `e6position` / `e6bbox` /
  `e6feature` / `e6geojson` (truncate to N decimals), `precisionForZoom`,
  `midpoint`, `isSamePosition`.
- **Bounding boxes & extents** — `getExtent` / `getExtents`, `extendExtent`,
  `padBBox`, `isBBoxEmpty`, `bbox4SimpleCenter`, `bboxToPolygon`, `addBbox`.
- **Polygons & rectangles** — `polygonFromPositions`,
  `polygonCoordinatesFromPositions`, `isRectangleNonzero`,
  `isLastPolygonSegmentIntersecting`.
- **Lines & points** — `findNearestPointOnLine`, `arePointsInLine`,
  `bufferPoint` (a small click hit-box around a screen point).
- **Repair** — `removeDegenerates` (drop/fix broken geometries, e.g. unclosed
  polygons) returning a clean `Geometry` or `null`.

```ts
import { roundCoordinates, getExtent } from "@epanet-js/geometry";
```
