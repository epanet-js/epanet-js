/**
 * Regression: demand cells must survive a copy -> paste round trip.
 *
 * Copy serialises a cell via `meta.copyValue` (applying any `toDisplay`
 * unit transform) and paste parses it back via `meta.pasteValue` (applying
 * the inverse `fromDisplay`). If those two ever stop being symmetric, a
 * value pasted into the same column drifts (we previously suspected a 100x
 * blow-up). These tests pin the symmetry for both the junction base demand
 * (no transform) and the customer-point base demand (l/s <-> l/d).
 */
import "src/__helpers__/locale";
import { describe, expect, it } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { presets } from "src/lib/project-settings/quantities-spec";
import type {
  FormattingSpec,
  UnitsSpec,
} from "src/lib/project-settings/quantities-spec";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import type { GridColumn } from "src/components/data-grid";
import { buildColumns } from "./asset-data-table-columns";
import { buildCustomerPointColumns } from "./customer-point-data-table-columns";

const units: UnitsSpec = presets.LPS.units;
const formatting: FormattingSpec = { decimals: {}, defaultDecimals: 3 };
const translate = (key: string) => key;
const translateUnit = ((unit: unknown) => (unit as string) ?? "") as never;

type DemandColumn = {
  accessorFn?: (row: unknown, index: number) => unknown;
  meta: {
    copyValue: (value: unknown) => string;
    pasteValue: (text: string, row: unknown) => unknown;
  };
};

const findColumn = <T>(columns: GridColumn<T>[], id: string): DemandColumn => {
  const column = columns.find((c) => c.id === id);
  if (!column) throw new Error(`column ${id} not found`);
  return column as unknown as DemandColumn;
};

const roundTrip = (column: DemandColumn, row: unknown) => {
  const stored = column.accessorFn?.(row, 0);
  const copied = column.meta.copyValue(stored);
  const pasted = column.meta.pasteValue(copied, row);
  return { stored, copied, pasted };
};

describe("junction base demand copy/paste", () => {
  it("round trips the stored value (no unit transform)", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1" })
      .aJunctionDemand(1, [{ baseDemand: 12.5 }])
      .build();

    const columns = buildColumns(
      [],
      undefined,
      "junction",
      translate,
      false,
      units,
      translateUnit,
      formatting,
      model.patterns,
      model.curves,
      defaultSimulationSettings,
      "none",
      undefined,
      undefined,
      { model, simulation: null, translate } as never,
    );

    const { stored, copied, pasted } = roundTrip(
      findColumn(columns, "baseDemand"),
      { id: 1 },
    );

    // l/s is the display unit too, so the clipboard text matches the value.
    expect(stored).toBe(12.5);
    expect(copied).toBe("12.5");
    expect(pasted).toBe(12.5);
  });
});

describe("customer point base demand copy/paste", () => {
  it("round trips through the l/s <-> l/d transform", () => {
    const model = HydraulicModelBuilder.with()
      .aCustomerPoint(1, { label: "CP1" })
      .aCustomerPointDemand(1, [{ baseDemand: 0.5 }])
      .build();

    const columns = buildCustomerPointColumns(
      translate,
      translateUnit,
      units,
      formatting,
      [],
      () => true,
      { model, units } as never,
    );

    const { stored, copied, pasted } = roundTrip(
      findColumn(columns, "baseDemand"),
      { id: 1 },
    );

    // 0.5 l/s displays/copies as 43200 l/d, then parses back to 0.5 l/s.
    expect(stored).toBe(0.5);
    expect(copied).toBe("43,200");
    expect(pasted).toBeCloseTo(0.5, 9);
  });
});
