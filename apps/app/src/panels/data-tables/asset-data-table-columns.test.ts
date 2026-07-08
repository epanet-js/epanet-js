import "src/__helpers__/locale";
import { describe, it, expect } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { presets } from "src/lib/project-settings/quantities-spec";
import type { FormattingSpec } from "src/lib/project-settings/quantities-spec";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import type { AssetType } from "@epanet-js/hydraulic-model";
import type { GridColumn } from "src/components/data-grid";
import {
  isNullableColumn,
  isOptionalColumn,
  isEmptiableColumn,
  buildColumns,
} from "./asset-data-table-columns";

const units = presets.LPS.units;
const formatting: FormattingSpec = { decimals: {}, defaultDecimals: 3 };
const translate = (key: string) => key;
const translateUnit = ((unit: unknown) => (unit as string) ?? "") as never;

const columnsFor = (
  type: AssetType,
  allowsNullValues = true,
): GridColumn<never>[] => {
  const model = HydraulicModelBuilder.with().build();
  return buildColumns(
    [],
    undefined,
    type,
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
    allowsNullValues,
  ) as never;
};

// `meta.hasWarning` is value-based (the grid passes the cell value and skips
// read-only cells separately).
const warnsWith = (
  columns: GridColumn<never>[],
  id: string,
  value: number | null,
): boolean => {
  // Direct-key columns carry `accessorKey`; computed ones carry `id` — the
  // resolved column id (what the grid uses) is `id ?? accessorKey`.
  const column = columns.find(
    (c) => (c.id ?? (c as { accessorKey?: string }).accessorKey) === id,
  );
  if (!column) throw new Error(`column ${id} not found`);
  return column.meta?.hasWarning?.(value as never) ?? false;
};

describe("isOptionalColumn", () => {
  it("treats `?: T` properties as optional (cleared -> undefined)", () => {
    expect(isOptionalColumn("bulkReactionCoeff")).toBe(true);
    expect(isOptionalColumn("wallReactionCoeff")).toBe(true);
    expect(isOptionalColumn("energyPrice")).toBe(true);
    expect(isOptionalColumn("chemicalSourceStrength")).toBe(true);
  });

  it("does not treat roughness or required columns as optional", () => {
    expect(isOptionalColumn("roughness")).toBe(false);
    expect(isOptionalColumn("diameter")).toBe(false);
  });

  it("treats EPANET-optional columns as optional only when null values are allowed", () => {
    for (const key of [
      "minorLoss",
      "emitterCoefficient",
      "minVolume",
      "mixingFraction",
      "speed",
      "initialQuality",
    ]) {
      expect(isOptionalColumn(key)).toBe(false);
      expect(isOptionalColumn(key, true)).toBe(true);
    }
  });
});

describe("isNullableColumn", () => {
  it("treats roughness as nullable only when null values are allowed", () => {
    expect(isNullableColumn("roughness", false)).toBe(false);
    expect(isNullableColumn("roughness", true)).toBe(true);
  });

  it("does not treat optional columns as nullable (they map to undefined)", () => {
    expect(isNullableColumn("bulkReactionCoeff", false)).toBe(false);
    expect(isNullableColumn("bulkReactionCoeff", true)).toBe(false);
  });

  it("treats batch-1 nullable columns as nullable when allowed", () => {
    expect(isNullableColumn("diameter", false)).toBe(false);
    expect(isNullableColumn("diameter", true)).toBe(true);
    expect(isNullableColumn("setting", true)).toBe(true);
    expect(isNullableColumn("head", true)).toBe(true);
    expect(isNullableColumn("initialLevel", true)).toBe(true);
    expect(isNullableColumn("minLevel", true)).toBe(true);
    expect(isNullableColumn("maxLevel", true)).toBe(true);
    expect(isNullableColumn("power", true)).toBe(true);
  });

  it("treats pipe length as nullable only when null values are allowed", () => {
    expect(isNullableColumn("length", false)).toBe(false);
    expect(isNullableColumn("length", true)).toBe(true);
  });

  it("treats node elevation as nullable only when null values are allowed", () => {
    expect(isNullableColumn("elevation", false)).toBe(false);
    expect(isNullableColumn("elevation", true)).toBe(true);
  });

  it("leaves optional-bound columns non-nullable", () => {
    // EPANET-optional attributes are excluded from the nullable batch.
    expect(isNullableColumn("minorLoss", true)).toBe(false);
    expect(isNullableColumn("minVolume", true)).toBe(false);
    expect(isNullableColumn("emitterCoefficient", true)).toBe(false);
  });
});

describe("isEmptiableColumn", () => {
  it("lets optional columns render empty regardless of the flag", () => {
    expect(isEmptiableColumn("bulkReactionCoeff", false)).toBe(true);
    expect(isEmptiableColumn("bulkReactionCoeff", true)).toBe(true);
  });

  it("lets roughness render empty only when null values are allowed", () => {
    expect(isEmptiableColumn("roughness", false)).toBe(false);
    expect(isEmptiableColumn("roughness", true)).toBe(true);
  });

  it("lets batch-1 nullable columns render empty only when allowed", () => {
    expect(isEmptiableColumn("diameter", false)).toBe(false);
    expect(isEmptiableColumn("diameter", true)).toBe(true);
  });

  it("lets pipe length render empty only when null values are allowed", () => {
    expect(isEmptiableColumn("length", false)).toBe(false);
    expect(isEmptiableColumn("length", true)).toBe(true);
  });
});

describe("cell validation highlight (meta.hasWarning)", () => {
  it("warns an empty required nullable cell (reservoir head)", () => {
    const columns = columnsFor("reservoir");
    expect(warnsWith(columns, "head", null)).toBe(true);
    expect(warnsWith(columns, "head", 100)).toBe(false);
  });

  it("warns a value that fails its validator (pipe minorLoss < 0)", () => {
    const columns = columnsFor("pipe");
    expect(warnsWith(columns, "minorLoss", -1)).toBe(true);
    expect(warnsWith(columns, "minorLoss", 0)).toBe(false);
  });

  it("does not warn an empty optional cell (pipe minorLoss)", () => {
    expect(warnsWith(columnsFor("pipe"), "minorLoss", null)).toBe(false);
  });

  it("warns an out-of-range integer value but not empty (pipe year)", () => {
    const columns = columnsFor("pipe");
    expect(warnsWith(columns, "year", -5)).toBe(true);
    expect(warnsWith(columns, "year", null)).toBe(false);
  });
});
