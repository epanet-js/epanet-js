import { describe, it, expect } from "vitest";
import { point } from "@turf/helpers";
import turfDistance from "@turf/distance";
import { prepareWorkerData } from "./prepare-data";
import { RunDataView } from "./run-data";
import {
  buildBucketDistances,
  searchBounds,
  findNearestPipeConnection,
} from "./nearest-pipe-connection";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";

const METERS_PER_DEGREE = 111194.93;
const toDegrees = (meters: number) => meters / METERS_PER_DEGREE;

describe("buildBucketDistances", () => {
  it.each([
    [100, [30, 60, 90, 100]],
    [120, [30, 60, 90, 120]],
    [30, [30]],
    [20, [20]],
    [0, []],
  ])("maxDistance %d", (maxDistance, expected) => {
    expect(buildBucketDistances(maxDistance)).toEqual(expected);
  });
});

describe("searchBounds", () => {
  it("reaches at least the search radius in every direction", () => {
    const origin: [number, number] = [10, 45];
    const distance = 100;
    const [minX, minY, maxX, maxY] = searchBounds(origin, distance);

    // Rounding between the bounds arithmetic and turf's haversine leaves a
    // sub-micrometre gap that cannot clip a real pipe segment.
    const roundingSlack = 1e-6;
    const reach = (target: [number, number]) =>
      turfDistance(origin, target, { units: "meters" });

    expect(reach([origin[0], maxY])).toBeGreaterThan(distance - roundingSlack);
    expect(reach([origin[0], minY])).toBeGreaterThan(distance - roundingSlack);
    expect(reach([maxX, origin[1]])).toBeGreaterThan(distance - roundingSlack);
    expect(reach([minX, origin[1]])).toBeGreaterThan(distance - roundingSlack);
  });

  it("widens the longitude span further from the equator", () => {
    const spanAt = (latitude: number) => {
      const [minX, , maxX] = searchBounds([0, latitude], 100);
      return maxX - minX;
    };

    expect(spanAt(60)).toBeGreaterThan(spanAt(0));
  });
});

describe("findNearestPipeConnection", () => {
  const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, NEAR: 10, FAR: 11 } as const;

  const dataWith = (nearDiameter: number) => {
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [0.02, 0] })
      .aPipe(IDS.NEAR, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: nearDiameter,
        coordinates: [
          [0, 0],
          [0.02, 0],
        ],
      })
      .aJunction(IDS.J3, { coordinates: [0, toDegrees(80)] })
      .aJunction(IDS.J4, { coordinates: [0.02, toDegrees(80)] })
      .aPipe(IDS.FAR, {
        startNodeId: IDS.J3,
        endNodeId: IDS.J4,
        diameter: 100,
        coordinates: [
          [0, toDegrees(80)],
          [0.02, toDegrees(80)],
        ],
      })
      .build();

    return new RunDataView(prepareWorkerData(model, [], "array"));
  };

  const customerPoint = point([0.01, toDegrees(20)]);

  it("connects to the nearest eligible pipe", () => {
    const connection = findNearestPipeConnection(
      customerPoint,
      120,
      300,
      dataWith(100),
    );

    expect(connection?.pipeId).toBe(IDS.NEAR);
    expect(connection?.junctionId).toBe(IDS.J1);
  });

  it("skips pipes wider than the rule and takes the next one", () => {
    const connection = findNearestPipeConnection(
      customerPoint,
      120,
      150,
      dataWith(200),
    );

    expect(connection?.pipeId).toBe(IDS.FAR);
  });

  it("returns null when everything is beyond maxDistance", () => {
    expect(
      findNearestPipeConnection(customerPoint, 10, 300, dataWith(100)),
    ).toBeNull();
  });
});
