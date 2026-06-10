import { describe, expect, it } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { presets } from "src/lib/project-settings/quantities-spec";
import {
  buildCustomerPointModelRows,
  buildCustomerPointRowsAsync,
  cpAccessor,
  isCpComputedKey,
  type CustomerPointRow,
} from "./customer-point-data-table-data";

const units = presets.LPS.units;

function buildModel() {
  return HydraulicModelBuilder.with()
    .aJunction(1, { label: "J1" })
    .aJunction(2, { label: "J2" })
    .aPipe(3, { label: "P1", startNodeId: 1, endNodeId: 2 })
    .aCustomerPoint(4, {
      label: "CP1",
      connection: { pipeId: 3, junctionId: 1 },
    })
    .aCustomerPointDemand(4, [{ baseDemand: 5 }])
    .build();
}

describe("isCpComputedKey", () => {
  it("treats demand/connection columns as computed and label as direct", () => {
    expect(isCpComputedKey("baseDemand")).toBe(true);
    expect(isCpComputedKey("avgDemand")).toBe(true);
    expect(isCpComputedKey("connectedPipeLabel")).toBe(true);
    expect(isCpComputedKey("patternId")).toBe(true);
    expect(isCpComputedKey("label")).toBe(false);
  });
});

describe("buildCustomerPointModelRows", () => {
  it("returns the customer-point objects with their ids", () => {
    const model = buildModel();
    const rows = buildCustomerPointModelRows(model);
    expect(rows.map((r) => r.id)).toEqual([4]);
    expect((rows[0] as unknown as { label: string }).label).toBe("CP1");
  });
});

describe("cpAccessor (computed columns)", () => {
  it("matches the legacy row builder for every computed column", async () => {
    const model = buildModel();
    const [legacy] = await buildCustomerPointRowsAsync(model, units);
    const row = { id: 4 } as CustomerPointRow;
    const ctx = { model, units };

    const computedKeys: (keyof CustomerPointRow)[] = [
      "connectedPipeLabel",
      "connectedJunctionLabel",
      "baseDemand",
      "avgDemand",
      "demandsCount",
      "patternId",
    ];
    for (const key of computedKeys) {
      expect(cpAccessor(key, ctx)(row)).toEqual(legacy[key]);
    }
  });

  it("converts the base demand to the per-day unit (not the raw value)", async () => {
    const model = buildModel();
    const [legacy] = await buildCustomerPointRowsAsync(model, units);
    const row = { id: 4 } as CustomerPointRow;

    // The stored demand is 5 in `customerDemand`; the column shows it converted
    // to `customerDemandPerDay`, so it must match the converted legacy value.
    expect(cpAccessor("baseDemand", { model, units })(row)).toBe(
      legacy.baseDemand,
    );
  });
});
