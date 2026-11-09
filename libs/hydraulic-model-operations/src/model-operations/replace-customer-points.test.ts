import { describe, it, expect } from "vitest";
import {
  buildCustomerPoint,
  buildTestFactories,
  HydraulicModelBuilder,
} from "@epanet-js/hydraulic-model-testing";
import {
  emptyCustomAttributesDefinition,
  getAttributes,
  getCustomerPointDemands,
  getJunctionDemands,
  setAttributes,
  type CustomerPoint,
  type Demand,
  type HydraulicModel,
} from "@epanet-js/hydraulic-model";
import { applyOperation } from "../__helpers__/apply-operation";
import { replaceCustomerPoints } from "./replace-customer-points";

const IDS = { J1: 1, OLD: 10, NEW1: 20, NEW2: 21 } as const;

type TestLabelManager = ReturnType<typeof buildTestFactories>["labelManager"];

const aModelWithCustomerPoints = (labelManager: TestLabelManager) =>
  HydraulicModelBuilder.with({ labelManager })
    .aJunction(IDS.J1)
    .aJunctionDemand(IDS.J1, [{ baseDemand: 30 }])
    .aCustomerPoint(IDS.OLD, { coordinates: [1, 1], label: "OLD" })
    .aCustomerPointDemand(IDS.OLD, [{ baseDemand: 5 }])
    .build();

const replace = (
  model: HydraulicModel,
  customerPoints: CustomerPoint[],
  {
    demands = new Map(),
    preserveJunctionDemands = true,
    customAttributes,
    labelManager,
  }: {
    demands?: Map<number, Demand[]>;
    preserveJunctionDemands?: boolean;
    customAttributes?: ReturnType<typeof emptyCustomAttributesDefinition>;
    labelManager: TestLabelManager;
  },
) =>
  applyOperation(
    model,
    replaceCustomerPoints(model, {
      customerPoints,
      customerPointDemands: demands,
      preserveJunctionDemands,
      customAttributes,
    }),
    labelManager,
  );

describe("replaceCustomerPoints", () => {
  it("swaps the existing customer points for the new ones", () => {
    const { labelManager } = buildTestFactories();
    const model = aModelWithCustomerPoints(labelManager);

    replace(
      model,
      [
        buildCustomerPoint(IDS.NEW1, { coordinates: [2, 2] }),
        buildCustomerPoint(IDS.NEW2, { coordinates: [3, 3] }),
      ],
      { labelManager },
    );

    expect([...model.customerPoints.keys()]).toEqual([IDS.NEW1, IDS.NEW2]);
    expect(model.customerPoints.get(IDS.NEW2)?.coordinates).toEqual([3, 3]);
  });

  it("assigns the new demands and clears the replaced ones", () => {
    const { labelManager } = buildTestFactories();
    const model = aModelWithCustomerPoints(labelManager);

    replace(model, [buildCustomerPoint(IDS.NEW1)], {
      demands: new Map([[IDS.NEW1, [{ baseDemand: 7 }]]]),
      labelManager,
    });

    expect(getCustomerPointDemands(model.demands, IDS.NEW1)).toEqual([
      { baseDemand: 7 },
    ]);
    expect(getCustomerPointDemands(model.demands, IDS.OLD)).toEqual([]);
  });

  it("keeps junction demands when asked to preserve them", () => {
    const { labelManager } = buildTestFactories();
    const model = aModelWithCustomerPoints(labelManager);

    replace(model, [buildCustomerPoint(IDS.NEW1)], {
      preserveJunctionDemands: true,
      labelManager,
    });

    expect(getJunctionDemands(model.demands, IDS.J1)).toEqual([
      { baseDemand: 30 },
    ]);
  });

  it("clears junction demands when not preserving them", () => {
    const { labelManager } = buildTestFactories();
    const model = aModelWithCustomerPoints(labelManager);

    replace(model, [buildCustomerPoint(IDS.NEW1)], {
      preserveJunctionDemands: false,
      labelManager,
    });

    expect(getJunctionDemands(model.demands, IDS.J1)).toEqual([]);
  });

  it("carries custom attribute values and the definition", () => {
    const { labelManager } = buildTestFactories();
    const model = aModelWithCustomerPoints(labelManager);
    const customerPoint = buildCustomerPoint(IDS.NEW1);
    customerPoint.setProperty("custom-1", "North");

    replace(model, [customerPoint], {
      customAttributes: setAttributes(
        emptyCustomAttributesDefinition(),
        "customerPoint",
        [{ id: "custom-1", label: "Area", type: "text" }],
      ),
      labelManager,
    });

    expect(model.customerPoints.get(IDS.NEW1)?.getProperty("custom-1")).toBe(
      "North",
    );
    expect(getAttributes(model.customAttributes, "customerPoint")).toEqual([
      { id: "custom-1", label: "Area", type: "text" },
    ]);
  });

  it("restores the previous state on undo and reapplies on redo", () => {
    const { labelManager } = buildTestFactories();
    const model = aModelWithCustomerPoints(labelManager);

    const { undo, redo } = replace(model, [buildCustomerPoint(IDS.NEW1)], {
      demands: new Map([[IDS.NEW1, [{ baseDemand: 7 }]]]),
      preserveJunctionDemands: false,
      labelManager,
    });

    undo();

    expect([...model.customerPoints.keys()]).toEqual([IDS.OLD]);
    expect(model.customerPoints.get(IDS.OLD)?.coordinates).toEqual([1, 1]);
    expect(getCustomerPointDemands(model.demands, IDS.OLD)).toEqual([
      { baseDemand: 5 },
    ]);
    expect(getCustomerPointDemands(model.demands, IDS.NEW1)).toEqual([]);
    expect(getJunctionDemands(model.demands, IDS.J1)).toEqual([
      { baseDemand: 30 },
    ]);

    redo();

    expect([...model.customerPoints.keys()]).toEqual([IDS.NEW1]);
    expect(getJunctionDemands(model.demands, IDS.J1)).toEqual([]);
  });
});
