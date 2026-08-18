import "src/__helpers__/locale";
import { describe, it, expect } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildRoughnessInferrer } from "src/hydraulic-model/pipe-materials";
import { presets } from "@epanet-js/project-settings";
import type { FormattingSpec } from "@epanet-js/project-settings";
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

const columnsFor = (type: AssetType): GridColumn<never>[] => {
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

  it("treats EPANET-optional columns as optional", () => {
    for (const key of [
      "minorLoss",
      "emitterCoefficient",
      "minVolume",
      "mixingFraction",
      "speed",
      "initialQuality",
    ]) {
      expect(isOptionalColumn(key)).toBe(true);
    }
  });
});

describe("isNullableColumn", () => {
  it("treats roughness as nullable", () => {
    expect(isNullableColumn("roughness")).toBe(true);
  });

  it("does not treat optional columns as nullable (they map to undefined)", () => {
    expect(isNullableColumn("bulkReactionCoeff")).toBe(false);
  });

  it("treats batch-1 nullable columns as nullable", () => {
    expect(isNullableColumn("diameter")).toBe(true);
    expect(isNullableColumn("setting")).toBe(true);
    expect(isNullableColumn("head")).toBe(true);
    expect(isNullableColumn("initialLevel")).toBe(true);
    expect(isNullableColumn("minLevel")).toBe(true);
    expect(isNullableColumn("maxLevel")).toBe(true);
    expect(isNullableColumn("power")).toBe(true);
  });

  it("treats pipe length as nullable", () => {
    expect(isNullableColumn("length")).toBe(true);
  });

  it("treats node elevation as nullable", () => {
    expect(isNullableColumn("elevation")).toBe(true);
  });

  it("leaves optional-bound columns non-nullable", () => {
    // EPANET-optional attributes are excluded from the nullable batch.
    expect(isNullableColumn("minorLoss")).toBe(false);
    expect(isNullableColumn("minVolume")).toBe(false);
    expect(isNullableColumn("emitterCoefficient")).toBe(false);
  });
});

describe("isEmptiableColumn", () => {
  it("lets optional columns render empty", () => {
    expect(isEmptiableColumn("bulkReactionCoeff")).toBe(true);
  });

  it("lets roughness render empty", () => {
    expect(isEmptiableColumn("roughness")).toBe(true);
  });

  it("lets batch-1 nullable columns render empty", () => {
    expect(isEmptiableColumn("diameter")).toBe(true);
  });

  it("lets pipe length render empty", () => {
    expect(isEmptiableColumn("length")).toBe(true);
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

describe("pipe roughness default (inferred from the pipe library)", () => {
  const IDS = { P1: 1 } as const;

  const roughnessDefault = ({
    material,
    roughness = null,
    withLibrary = true,
  }: {
    material?: string;
    roughness?: number | null;
    withLibrary?: boolean;
  }) => {
    const builder = HydraulicModelBuilder.with().aPipe(IDS.P1, {
      roughness,
      material,
    });
    if (withLibrary) {
      builder.aPipeMaterial({
        label: "Cast Iron",
        entries: [{ age: 0, roughness: 120 }],
      });
    }
    const model = builder.build();
    const rows = [model.assets.get(IDS.P1)];

    const columns = buildColumns(
      [],
      undefined,
      "pipe",
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
      (rowIndex: number) => rows[rowIndex] as never,
      { model, simulation: null, translate } as never,
      undefined,
      undefined,
      undefined,
      buildRoughnessInferrer(model.pipeMaterials),
    ) as GridColumn<never>[];

    const column = columns.find(
      (c) =>
        (c.id ?? (c as { accessorKey?: string }).accessorKey) === "roughness",
    );
    const defaultValue = column?.meta?.defaultValue as
      | number
      | null
      | ((rowIndex: number) => number | null)
      | undefined;
    return typeof defaultValue === "function" ? defaultValue(0) : defaultValue;
  };

  it("offers the library roughness for a pipe without one", () => {
    expect(roughnessDefault({ material: "Cast Iron" })).toBe(120);
  });

  it("offers nothing when the material is not in the library", () => {
    expect(roughnessDefault({ material: "PVC" })).toBeNull();
  });

  it("offers nothing when there is no library", () => {
    expect(
      roughnessDefault({ material: "Cast Iron", withLibrary: false }),
    ).toBeNull();
  });

  it("clears the missing-value warning once a default applies", () => {
    const columns = columnsFor("pipe");

    expect(warnsWith(columns, "roughness", null)).toBe(true);
    expect(warnsWith(columns, "roughness", 120)).toBe(false);
  });
});
