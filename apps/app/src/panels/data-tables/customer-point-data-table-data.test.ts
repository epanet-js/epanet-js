import { describe, expect, it } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { presets } from "src/lib/project-settings/quantities-spec";
import {
  buildCustomerPointModelRows,
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
  it("resolves the connection and demand columns from the model", () => {
    const model = buildModel();
    const row = { id: 4 } as CustomerPointRow;
    const ctx = { model, units };

    expect(cpAccessor("connectedPipeLabel", ctx)(row)).toBe("P1");
    expect(cpAccessor("connectedJunctionLabel", ctx)(row)).toBe("J1");
    expect(cpAccessor("demandsCount", ctx)(row)).toBe(1);
    expect(cpAccessor("patternId", ctx)(row)).toBeNull();
  });

  it("returns the RAW (stored) demand — the column converts for display", () => {
    const model = buildModel();
    const row = { id: 4 } as CustomerPointRow;
    const ctx = { model, units };

    // The accessor is the sort/copy source: it returns the model-native stored
    // value (5), NOT the per-day value the column renders for display.
    expect(cpAccessor("baseDemand", ctx)(row)).toBe(5);
    expect(cpAccessor("avgDemand", ctx)(row)).toBe(5);
  });
});
