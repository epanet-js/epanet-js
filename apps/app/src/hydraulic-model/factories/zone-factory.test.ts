import { ZoneFactory, buildZonePreviewFactory } from "./zone-factory";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { ConsecutiveIdsGenerator } from "src/lib/id-generator";
import type { Polygon, MultiPolygon } from "geojson";

describe("ZoneFactory", () => {
  it("generates sequential Z-prefixed labels with label manager", () => {
    const labelManager = new LabelManager();
    const factory = new ZoneFactory(
      new ConsecutiveIdsGenerator(),
      labelManager,
    );

    const z1 = factory.create(polygon);
    const z2 = factory.create(polygon);

    expect(z1.label).toBe("Z1");
    expect(z2.label).toBe("Z2");
  });

  it("uses explicit label and registers it with label manager", () => {
    const labelManager = new LabelManager();
    const factory = new ZoneFactory(
      new ConsecutiveIdsGenerator(),
      labelManager,
    );

    const zone = factory.create(polygon, { label: "DMA North" });

    expect(zone.label).toBe("DMA North");
    expect(labelManager.isLabelAvailable("DMA North", "zone")).toBe(false);
  });

  it("skips registered labels when generating", () => {
    const labelManager = new LabelManager();
    labelManager.register("Z1", "zone", 99);
    const factory = new ZoneFactory(
      new ConsecutiveIdsGenerator(),
      labelManager,
    );

    const zone = factory.create(polygon);

    expect(zone.label).toBe("Z2");
  });

  it("stores geometry correctly for Polygon", () => {
    const labelManager = new LabelManager();
    const factory = new ZoneFactory(
      new ConsecutiveIdsGenerator(),
      labelManager,
    );

    const zone = factory.create(polygon);

    expect(zone.geometry).toEqual(polygon);
  });

  it("stores geometry correctly for MultiPolygon", () => {
    const labelManager = new LabelManager();
    const factory = new ZoneFactory(
      new ConsecutiveIdsGenerator(),
      labelManager,
    );

    const zone = factory.create(multiPolygon);

    expect(zone.geometry).toEqual(multiPolygon);
  });

  it("loads a zone with a given id and registers label", () => {
    const labelManager = new LabelManager();
    const factory = new ZoneFactory(
      new ConsecutiveIdsGenerator(),
      labelManager,
    );

    const zone = factory.load({ id: 42, geometry: polygon, label: "Zone A" });

    expect(zone.id).toBe(42);
    expect(zone.label).toBe("Zone A");
    expect(zone.geometry).toEqual(polygon);
    expect(labelManager.isLabelAvailable("Zone A", "zone")).toBe(false);
  });
});

describe("buildZonePreviewFactory", () => {
  it("seeds the preview with existing zone labels", () => {
    const sourceLabelManager = new LabelManager();
    const sourceFactory = new ZoneFactory(
      new ConsecutiveIdsGenerator(),
      sourceLabelManager,
    );
    sourceFactory.create(polygon);
    sourceFactory.create(polygon);
    sourceFactory.create(polygon);

    const previewFactory = buildZonePreviewFactory(sourceLabelManager);

    expect(previewFactory.create(polygon).label).toBe("Z4");
  });

  it("repeated builds produce stable labels", () => {
    const sourceLabelManager = new LabelManager();
    sourceLabelManager.register("Z1", "zone", 99);

    const firstPreview = buildZonePreviewFactory(sourceLabelManager);
    firstPreview.create(polygon);
    firstPreview.create(polygon);

    const secondPreview = buildZonePreviewFactory(sourceLabelManager);

    expect(secondPreview.create(polygon).label).toBe("Z2");
    expect(secondPreview.create(polygon).label).toBe("Z3");
  });

  it("does not mutate the source label manager", () => {
    const sourceLabelManager = new LabelManager();
    sourceLabelManager.register("Z1", "zone", 99);

    const previewFactory = buildZonePreviewFactory(sourceLabelManager);
    previewFactory.create(polygon);
    previewFactory.create(polygon, { label: "ExplicitLabel" });

    expect(sourceLabelManager.isLabelAvailable("Z2", "zone")).toBe(true);
    expect(sourceLabelManager.isLabelAvailable("ExplicitLabel", "zone")).toBe(
      true,
    );
  });
});

const polygon: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
};

const multiPolygon: MultiPolygon = {
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
    [
      [
        [2, 2],
        [3, 2],
        [3, 3],
        [2, 2],
      ],
    ],
  ],
};
