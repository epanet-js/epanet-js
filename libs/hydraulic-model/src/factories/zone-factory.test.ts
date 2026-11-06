import type { MultiPolygon } from "geojson";
import { ZoneFactory } from "./zone-factory";
import { LabelManager } from "../label-manager";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";

const geometry: MultiPolygon = {
  type: "MultiPolygon",
  coordinates: [
    [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  ],
};

describe("ZoneFactory", () => {
  it("generates Z-prefixed labels with label manager", () => {
    const labelManager = new LabelManager();
    const factory = new ZoneFactory(
      new ConsecutiveIdsGenerator(),
      labelManager,
    );

    const zone1 = factory.create(geometry);
    const zone2 = factory.create(geometry);

    expect(zone1.label).toBe("Z1");
    expect(zone2.label).toBe("Z2");
    expect(labelManager.isLabelAvailable("Z2", "zone")).toBe(false);
  });

  it("uses explicit label and registers it with label manager", () => {
    const labelManager = new LabelManager();
    const factory = new ZoneFactory(
      new ConsecutiveIdsGenerator(),
      labelManager,
    );

    const zone = factory.create(geometry, "NORTH");

    expect(zone.label).toBe("NORTH");
    expect(labelManager.isLabelAvailable("NORTH", "zone")).toBe(false);
    expect(labelManager.isLabelAvailable("NORTH", "zone", zone.id)).toBe(true);
  });

  it("gives a zone a free label when the one asked for is taken", () => {
    const labelManager = new LabelManager();
    labelManager.register("NORTH", "zone", 99);
    const factory = new ZoneFactory(
      new ConsecutiveIdsGenerator(),
      labelManager,
    );

    expect(factory.create(geometry, "North").label).toBe("North_1");
    expect(labelManager.isLabelAvailable("North_1", "zone")).toBe(false);
  });

  it("keeps a long label whole when it adds a suffix", () => {
    const label = "NORTH DISTRICT METERED AREA BOUNDARY";
    const labelManager = new LabelManager();
    labelManager.register(label, "zone", 99);
    const factory = new ZoneFactory(
      new ConsecutiveIdsGenerator(),
      labelManager,
    );

    expect(factory.create(geometry, label).label).toBe(`${label}_1`);
  });

  it("skips labels already taken by other zones when generating", () => {
    const labelManager = new LabelManager();
    labelManager.register("Z1", "zone", 99);
    const factory = new ZoneFactory(
      new ConsecutiveIdsGenerator(),
      labelManager,
    );

    expect(factory.create(geometry).label).toBe("Z2");
  });
});
