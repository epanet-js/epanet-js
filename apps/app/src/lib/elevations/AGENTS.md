# Elevations

Resolves an elevation for one geographic point or many at once, from an ordered list of **sources**. A source is either a **tile-server** (remote Terrain-RGB tiles, e.g. Mapbox's `mapbox-terrain-dem-v1`) or a **geotiff** (a DTM raster the user uploaded as a local `File`).

## Sources are ordered; last wins, offsets stack

`fetchElevationFromSources` / `fetchElevationsFromSources` iterate sources in **reverse** order (last = highest priority) and take the first source that returns a value for a point, then add that source's `elevationOffsetM`. The batch variant fills only still-unresolved points from each successive source, so a higher-priority hit is never overwritten. This lets a precise local DTM sit over a coarse global tile-server and win where it has coverage while the global one fills the gaps.

## The batching model: group by locality, touch each unit of cost once

The core invariant: **bulk cost scales with the number of distinct resources touched, not the number of points.** Both source types group nearby points so each expensive resource — a network tile, or a raster block — is fetched/decoded once, then every point sharing it is read from that one buffer. N points over K resources cost K, not N.

**Tile-server** ([tile-server-elevation.ts](tile-server-elevation.ts)): `groupPointsByTile` maps each point to its `{z}/{x}/{y}` slippy tile. Each unique tile is fetched once (one PNG request) and decoded once; tiles are cached in a react-query `queryClient` (`staleTime` 5 min) so repeats dedupe across calls. The one-request-per-tile you see in the network tab is **our** grouping, not the server's — it just serves one PNG per request.

**GeoTIFF** ([geotiff/fetch-elevation.ts](geotiff/fetch-elevation.ts)): points are grouped by which tile's bbox contains them (earlier tiles win on overlap), then `bucketPointsByCell` groups them into `READ_BUCKET_SIZE` (256 px) raster cells, one `readRasters` per bucket. The bucket is a small multiple of the internal block size, so a read only decompresses the blocks its points live in — critical for a diagonal path, where a single union-window read would decompress the whole raster.

The two are bound by different costs: tile-server is **network-bound** (remote, cacheable); GeoTIFF is **CPU-bound** on a local `File`, so the DTM path issues no request and shows nothing in the network tab.

## No node limit; the scaling risk is fetch concurrency

Nothing caps point count, and nothing needs to — cost tracks distinct tiles/blocks. The `maxCalls`/`callsIntervalMs` on the tile fetch are **diagnostic only** (`withDebugInstrumentation` warns in debug mode); they throttle nothing. The real risk is that the tile-server fetch fires **all** unique-tile requests at once via `Promise.all`: a geographically-spread model issues hundreds of simultaneous `fetch()`es. If tile-server rate-limiting ever bites, add a concurrency pool here — not a point-count cap.

## Rules

- Unresolved points are `null`, not `0` — out-of-bounds and nodata stay `null` so the model can represent "no elevation"; callers coalesce to a fallback only behind the feature flag.
- Any new bulk path must group by locality and touch each tile/block once — never one fetch or `readRasters` per point.
- Don't raise `READ_BUCKET_SIZE` toward the raster size to "read less often": a larger bucket decompresses *more* blocks per read.

## Where it lives

- Source dispatch, priority, batching entry points — `fetch-elevation.ts` (`fetchElevation(s)FromSources`).
- Tile-server fetch, grouping, decode, cache — `tile-server-elevation.ts`.
- GeoTIFF sampling, point→tile grouping, 256px bucketing, bilinear/nearest — `geotiff/fetch-elevation.ts`.
- GeoTIFF parsing and the `GeoTiffTile` shape — `geotiff/parse-geotiff.ts`, `geotiff/types.ts`.
- Source type definitions — `elevation-source-types.ts`.

App-facing hooks (`useElevations`, recompute, notifications, offline) live outside this module under `src/map/elevations/` and `src/commands/recompute-elevations.tsx`.
