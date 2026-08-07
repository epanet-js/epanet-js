# Elevations

Resolves an elevation for one geographic point or many at once, from an ordered list of **sources**. A source is either a **tile-server** (remote Terrain-RGB tiles, e.g. Mapbox's `mapbox-terrain-dem-v1`) or a **geotiff** (a DTM raster the user uploaded as a local `File`).

## Sources are ordered; last wins, offsets stack

`fetchElevationFromSources` / `fetchElevationsFromSources` iterate sources in **reverse** order (last = highest priority) and take the first source that returns a value for a point, then add that source's `elevationOffsetM`. The batch variant fills only still-unresolved points from each successive source, so a higher-priority hit is never overwritten. This lets a precise local DTM sit over a coarse global tile-server and win where it has coverage while the global one fills the gaps.

## The batching model: group by locality, touch each unit of cost once

The core invariant: **bulk cost scales with the number of distinct resources touched, not the number of points.** Both source types group nearby points so each expensive resource — a network tile, or a raster block — is fetched/decoded once, then every point sharing it is read from that one buffer. N points over K resources cost K, not N.

**Tile-server** ([tile-server-elevation.ts](tile-server-elevation.ts)): `groupPointsByTile` maps each point to its `{z}/{x}/{y}` slippy tile. Each unique tile is fetched once (one PNG request) and decoded once; tiles are cached in a `queryClient` (`staleTime` 5 min) that lives in `@epanet-js/elevations`, so repeats dedupe across calls **and** across the single-point path — a tile warmed by an interactive prefetch is reused here. The one-request-per-tile you see in the network tab is **our** grouping, not the server's — it just serves one PNG per request.

**GeoTIFF** ([geotiff/fetch-elevation.ts](geotiff/fetch-elevation.ts)): points are grouped by which tile's bbox contains them (earlier tiles win on overlap), then `bucketPointsByCell` groups them into `READ_BUCKET_SIZE` (256 px) raster cells, one `readRasters` per bucket. The bucket is a small multiple of the internal block size, so a read only decompresses the blocks its points live in — critical for a diagonal path, where a single union-window read would decompress the whole raster.

The two are bound by different costs: tile-server is **network-bound** (remote, cacheable); GeoTIFF is **local-I/O-bound** on a `File`, so the DTM path issues no request and shows nothing in the network tab.

## GeoTIFF read cost: per-block FileReader I/O, and when we go in-memory

A GeoTIFF opened from a `File` (`fromBlob`) is served one internal block at a time, each via its own async `FileReader` round-trip against the blob. Decode is cheap; this **per-block I/O is what dominates** a bulk read that spans many blocks — recompute-all over a network that blankets a tile touches ~100+ blocks per file, and those round-trips added up to seconds. It is not a decode or a redundant-read problem: each block is already read once.

The mitigation is to stop paying the round-trip. When a tile read will touch enough distinct blocks, we load the whole file into memory once (`fromArrayBuffer`) and read from that — block reads become synchronous in-memory slices. The in-memory image is scoped to the single read, so only the tile currently being read is held. This is **gated by file size**: a source can be a few-MB tile in a multi-file DTM *or* a single multi-GB raster that cannot fit in memory, so above the cap we keep streaming blocks off the blob and never attempt to load it whole (loading it would OOM the tab).

A second, smaller optimization collapses the per-bucket reads into a single read when that read would decode no more internal blocks than the buckets do in aggregate — true for single-strip rasters, where every read decodes the whole strip regardless. For a sparse path across a large tiled raster it keeps the small per-bucket reads.

**Known limitation:** a multi-GB raster stored as narrow strips still incurs occasional multi-second stalls on interactive single-point reads (drawing a node). That is cold disk I/O fetching a strip from a file too big to hold in memory — OS/disk latency the reader cannot eliminate. UX that must stay responsive should resolve elevation asynchronously rather than block on it.

## No node limit; concurrency is capped, not the point count

Nothing caps point count, and nothing needs to — cost tracks distinct tiles/blocks. What is capped is how many tiles are in flight: `fetchElevationsForPoints` runs its tile groups through `runWithConcurrency` with `TILE_FETCH_CONCURRENCY = 12`, a fixed pool of runners pulling from a shared cursor. Aborting stops new tiles from starting; in-flight ones finish. The `maxCalls`/`callsIntervalMs` on the tile fetch are **diagnostic only** (`withDebugInstrumentation` warns in debug mode) and throttle nothing — the pool is what bounds the load.

## Rules

- Unresolved points are `null`, not `0` — out-of-bounds, nodata and a failed tile all stay `null` so the model can represent "no elevation". Nothing coalesces to a fallback: a `0` in the model means sea level, and must never mean "we could not resolve this".
- Any new bulk path must group by locality and touch each tile/block once — never one fetch or `readRasters` per point.
- Don't raise `READ_BUCKET_SIZE` toward the raster size to "read less often": a larger bucket decompresses *more* blocks per read.
- The in-memory read is size-gated on purpose: never load a file past `MAX_IN_MEMORY_FILE_BYTES` whole — a multi-GB raster must keep streaming its blocks, or it will OOM the tab.

## Where it lives

- Source dispatch, priority, batching entry points — `fetch-elevation.ts` (`fetchElevation(s)FromSources`).
- Tile grouping and the concurrency pool — `tile-server-elevation.ts`.
- GeoTIFF sampling, point→tile grouping, 256px bucketing, bilinear/nearest — `geotiff/fetch-elevation.ts`.
- GeoTIFF parsing — `geotiff/parse-geotiff.ts`. The engine-side `EngineTile` narrowing — `geotiff/types.ts`.

The shared package `@epanet-js/elevations` owns everything a single point needs: the source and tile types, the tile math and Terrain-RGB decode, the tile fetch and its `queryClient` cache, both canvas setups, and `defaultElevationEngine`. This module builds the batched path on top of it. `elevation-source-types.ts` and `geotiff/types.ts` are re-export shims over that package.

App-facing code lives outside this module: the `useElevations` hook (notifications, offline) at `src/hooks/use-elevations.ts`, and recompute at `src/commands/recompute-elevations.tsx`.
