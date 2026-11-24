import { describe, it, expect } from "vitest";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import type { PipeMaterial } from "@epanet-js/hydraulic-model";
import { changePipeMaterials } from "./change-pipe-materials";

const aMaterial = (label: string): PipeMaterial => ({
  label,
  entries: [{ age: 0, roughness: 120 }],
});

const aModelWith = (...labels: string[]) =>
  labels
    .reduce(
      (builder, label) => builder.aPipeMaterial(aMaterial(label)),
      HydraulicModelBuilder.with(),
    )
    .build();

describe("changePipeMaterials", () => {
  it("adds a material with a new name", () => {
    const model = aModelWith("Cast Iron");

    expect(() =>
      changePipeMaterials(model, {
        pipeMaterials: [...model.pipeMaterials, aMaterial("PVC")],
        materialAssignments: [],
      }),
    ).not.toThrow();
  });

  it("refuses a new material whose name differs only by case", () => {
    const model = aModelWith("Cast Iron");

    expect(() =>
      changePipeMaterials(model, {
        pipeMaterials: [...model.pipeMaterials, aMaterial("CAST IRON")],
        materialAssignments: [],
      }),
    ).toThrow(
      "Cannot add pipe material CAST IRON; Cast Iron already has that name",
    );
  });

  it("refuses a new material without a name", () => {
    const model = aModelWith("Cast Iron");

    expect(() =>
      changePipeMaterials(model, {
        pipeMaterials: [...model.pipeMaterials, aMaterial("")],
        materialAssignments: [],
      }),
    ).toThrow("Cannot add a pipe material without a name");
  });

  it("keeps saving a library that already has names differing only by case", () => {
    const model = aModelWith("PVC", "pvc");

    expect(() =>
      changePipeMaterials(model, {
        pipeMaterials: [...model.pipeMaterials, aMaterial("Steel")],
        materialAssignments: [],
      }),
    ).not.toThrow();
  });
});
