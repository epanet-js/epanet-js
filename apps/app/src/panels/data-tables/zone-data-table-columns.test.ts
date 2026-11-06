import { describe, it, expect } from "vitest";
import type { ColumnDefBase } from "@tanstack/react-table";
import { buildZone } from "@epanet-js/hydraulic-model-testing";
import { defaultProjectSettings } from "@epanet-js/project-settings";
import { buildZoneColumns } from "./zone-data-table-columns";
import type { ZoneRow } from "./zone-data-table-data";

const { formatting } = defaultProjectSettings;
const translate = (key: string) => key;

const build = (customAttributes: Parameters<typeof buildZoneColumns>[3]) =>
  buildZoneColumns(translate, formatting, () => true, customAttributes);

const aZone = (customAttributes: Record<string, string | number>) =>
  buildZone({
    id: 1,
    label: "NORTH",
    geometry: {
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
    },
    bbox: [0, 0, 1, 1],
    customAttributes,
  });

describe("buildZoneColumns custom attributes", () => {
  it("appends a column per custom attribute", () => {
    const columns = build([
      { id: "custom-1", label: "Area", type: "text" },
      { id: "custom-2", label: "Age", type: "number" },
    ]);

    const ids = columns.map((c) => (c as { id?: string }).id);
    expect(ids).toContain("custom-1");
    expect(ids).toContain("custom-2");
  });

  it("reads the value from the zone via getProperty", () => {
    const columns = build([{ id: "custom-1", label: "Area", type: "text" }]);
    const column = columns.find(
      (c) => (c as { id?: string }).id === "custom-1",
    ) as ColumnDefBase<ZoneRow, unknown> & {
      accessorFn: (row: ZoneRow, index: number) => unknown;
    };

    const zone = aZone({ "custom-1": "LOW" });

    expect(column.accessorFn(zone as unknown as ZoneRow, 0)).toBe("LOW");
  });

  it("returns no custom columns when none are defined", () => {
    const columns = build([]);
    const ids = columns.map((c) => (c as { id?: string }).id);
    expect(ids).not.toContain("custom-1");
  });
});
