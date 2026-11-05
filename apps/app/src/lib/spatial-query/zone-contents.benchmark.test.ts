/* eslint-disable no-console */
import type { Position } from "geojson";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import turfBbox from "@turf/bbox";
import {
  HydraulicModelBuilder,
  type ZoneBuildData,
} from "@epanet-js/hydraulic-model-testing";
import {
  AssetsGeoView,
  CustomerPointsGeoView,
  encodeCustomerPointsGeo,
  encodeZonesGeo,
  queryZoneContents,
  ZonesGeoView,
  type LinkAsset,
  type NodeAsset,
  type Zone,
} from "@epanet-js/hydraulic-model";
import { AssetIndexView } from "src/hydraulic-model/asset-index-transferable";
import { encodeHydraulicModel } from "./data";

const ZONE_COUNT = 1000;
const VERTICES_PER_ZONE = 1000;
const COLUMNS = 40;
const CELL = 0.01;
const SPACING = 0.001;
const CUSTOMER_POINTS = 100000;
const RUNS = 10;
const OFFSET = 0.0000317;
const LARGE_ZONE_ID = ZONE_COUNT + 1;

const width = COLUMNS * CELL;
const height = (ZONE_COUNT / COLUMNS) * CELL;

const wavyRing = (
  cx: number,
  cy: number,
  radius: number,
  seed: number,
): Position[] => {
  const ring: Position[] = [];
  for (let i = 0; i < VERTICES_PER_ZONE; i++) {
    const angle = (i / VERTICES_PER_ZONE) * 2 * Math.PI;
    const r = radius * (1 + 0.08 * Math.sin(angle * (7 + (seed % 5))));
    ring.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }
  ring.push(ring[0]);
  return ring;
};

const aZone = (id: number, ring: Position[]): ZoneBuildData => {
  const geometry = {
    type: "MultiPolygon" as const,
    coordinates: [[ring]],
  };
  return {
    id,
    label: `Z${id}`,
    geometry,
    bbox: turfBbox(geometry) as Zone["bbox"],
  };
};

const buildModel = () => {
  const builder = HydraulicModelBuilder.with();
  const columns = Math.round(width / SPACING);
  const rows = Math.round(height / SPACING);
  const nodeId = (col: number, row: number) => row * columns + col + 1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      builder.aJunction(nodeId(col, row), {
        coordinates: [
          col * SPACING - CELL / 2 + OFFSET,
          row * SPACING - CELL / 2 + OFFSET,
        ],
      });
    }
  }
  let linkId = columns * rows + 1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      if (col + 1 < columns)
        builder.aPipe(linkId++, {
          startNodeId: nodeId(col, row),
          endNodeId: nodeId(col + 1, row),
        });
      if (row + 1 < rows)
        builder.aPipe(linkId++, {
          startNodeId: nodeId(col, row),
          endNodeId: nodeId(col, row + 1),
        });
    }
  }
  let seed = 1;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < CUSTOMER_POINTS; i++) {
    builder.aCustomerPoint(linkId + i, {
      coordinates: [random() * width - CELL / 2, random() * height - CELL / 2],
    });
  }
  for (let i = 0; i < ZONE_COUNT; i++) {
    const cx = (i % COLUMNS) * CELL;
    const cy = Math.floor(i / COLUMNS) * CELL;
    builder.aZone(aZone(i + 1, wavyRing(cx, cy, CELL * 0.45, i)));
  }
  builder.aZone(
    aZone(
      LARGE_ZONE_ID,
      wavyRing(width / 2 - CELL / 2, height / 2 - CELL / 2, height * 0.4, 3),
    ),
  );
  return builder.build();
};

const orient = (a: Position, b: Position, c: Position) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

const strictlyCross = (a: Position, b: Position, c: Position, d: Position) =>
  orient(c, d, a) * orient(c, d, b) < 0 &&
  orient(a, b, c) * orient(a, b, d) < 0;

const bruteForce = (
  model: ReturnType<typeof buildModel>,
  zoneIds: number[],
) => {
  const assetIds = new Set<number>();
  const boundaryAssetIds = new Set<number>();
  const customerPointIds = new Set<number>();
  for (const zoneId of zoneIds) {
    const zone = model.zones.get(zoneId)!;
    const polygons = zone.geometry.coordinates;
    const [minX, minY, maxX, maxY] = zone.bbox;
    const isNear = (p: Position) =>
      p[0] >= minX && p[0] <= maxX && p[1] >= minY && p[1] <= maxY;
    const inPolygon = (p: Position, rings: Position[][]) =>
      booleanPointInPolygon(p, { type: "Polygon", coordinates: rings });
    const inZone = (p: Position) =>
      polygons.some((rings) => inPolygon(p, rings));
    for (const asset of model.assets.values()) {
      if (!asset.isLink) {
        const position = (asset as NodeAsset).coordinates;
        if (isNear(position) && inZone(position)) assetIds.add(asset.id);
        continue;
      }
      const line = (asset as LinkAsset).coordinates;
      const xs = line.map((p) => p[0]);
      const ys = line.map((p) => p[1]);
      if (
        Math.max(...xs) < minX ||
        Math.min(...xs) > maxX ||
        Math.max(...ys) < minY ||
        Math.min(...ys) > maxY
      )
        continue;
      const crossesRings = (rings: Position[][]) =>
        rings.some((ring) =>
          ring.some(
            (_, j) =>
              j > 0 &&
              line.some(
                (_, i) =>
                  i > 0 &&
                  strictlyCross(line[i - 1], line[i], ring[j - 1], ring[j]),
              ),
          ),
        );
      const contained = polygons.some(
        (rings) =>
          line.every((p) => inPolygon(p, rings)) && !crossesRings(rings),
      );
      if (contained) {
        assetIds.add(asset.id);
        boundaryAssetIds.delete(asset.id);
      } else if (
        !assetIds.has(asset.id) &&
        inZone(line[0]) !== inZone(line[line.length - 1])
      ) {
        boundaryAssetIds.add(asset.id);
      }
    }
    for (const customerPoint of model.customerPoints.values()) {
      if (
        isNear(customerPoint.coordinates) &&
        inZone(customerPoint.coordinates)
      )
        customerPointIds.add(customerPoint.id);
    }
  }
  const sorted = (ids: Set<number>) => [...ids].sort((a, b) => a - b);
  return {
    assetIds: sorted(assetIds),
    boundaryAssetIds: sorted(boundaryAssetIds),
    customerPointIds: sorted(customerPointIds),
  };
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

describe("zone contents benchmark", () => {
  it("queries the contents of zones in a large network", () => {
    const buildStart = performance.now();
    const model = buildModel();
    console.log(
      `model: ${model.assets.size} assets, ${model.customerPoints.size} customer points, ${model.zones.size} zones (built in ${(
        performance.now() - buildStart
      ).toFixed(0)} ms)`,
    );

    const indexStart = performance.now();
    const { assetsGeoBuffers, assetIndexBuffers } = encodeHydraulicModel(model);
    const assetsGeo = new AssetsGeoView(
      assetsGeoBuffers,
      new AssetIndexView(assetIndexBuffers),
    );
    const customerPointsGeo = new CustomerPointsGeoView(
      encodeCustomerPointsGeo(model.customerPoints),
    );
    const zonesGeo = new ZonesGeoView(encodeZonesGeo(model.zones));
    queryZoneContents(zonesGeo, assetsGeo, customerPointsGeo, [1]);
    console.log(
      `encoding and first query: ${(performance.now() - indexStart).toFixed(0)} ms`,
    );

    const cases = [
      { name: "one small zone", zoneIds: [500] },
      {
        name: "50 small zones",
        zoneIds: Array.from({ length: 50 }, (_, i) => 300 + i),
      },
      { name: "one large zone", zoneIds: [LARGE_ZONE_ID] },
    ];

    for (const { name, zoneIds } of cases) {
      const timings: number[] = [];
      let result = queryZoneContents(
        zonesGeo,
        assetsGeo,
        customerPointsGeo,
        zoneIds,
      );
      for (let run = 0; run < RUNS; run++) {
        const start = performance.now();
        result = queryZoneContents(
          zonesGeo,
          assetsGeo,
          customerPointsGeo,
          zoneIds,
        );
        timings.push(performance.now() - start);
      }

      const bruteStart = performance.now();
      const expected = bruteForce(model, zoneIds);
      const bruteMs = performance.now() - bruteStart;

      console.log(
        `${name}: ${result.assetIds.length} assets, ${result.boundaryAssetIds.length} boundary, ${result.customerPointIds.length} customer points — median ${median(
          timings,
        ).toFixed(
          1,
        )} ms, max ${Math.max(...timings).toFixed(1)} ms (brute force ${bruteMs.toFixed(0)} ms)`,
      );
      const sorted = (ids: number[]) => [...ids].sort((a, b) => a - b);
      expect({
        assetIds: sorted(result.assetIds),
        boundaryAssetIds: sorted(result.boundaryAssetIds),
        customerPointIds: sorted(result.customerPointIds),
      }).toEqual(expected);
    }
  });
});
