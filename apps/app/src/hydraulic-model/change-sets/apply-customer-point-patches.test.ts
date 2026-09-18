import { describe, it, expect } from "vitest";
import { getActiveCustomerPoints } from "@epanet-js/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { applyOperation } from "src/__helpers__/apply-operation";
import { buildTestFactories } from "src/__helpers__/test-factories";
import { changeCustomerPointProperty } from "../model-operations/change-customer-point-property";

const IDS = { J1: 1, P1: 2, CP1: 3 } as const;

const buildConnectedModel = (
  labelManager = buildTestFactories().labelManager,
) =>
  HydraulicModelBuilder.with({ labelManager })
    .aJunction(IDS.J1)
    .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J1 })
    .aCustomerPoint(IDS.CP1, {
      label: "old",
      connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
    })
    .build();

describe("change sets from customer point patches", () => {
  it("applies a label patch and keeps the connection", () => {
    const { labelManager } = buildTestFactories();
    const model = buildConnectedModel(labelManager);

    const moment = changeCustomerPointProperty(model, {
      customerPointIds: [IDS.CP1],
      property: "label",
      value: "new",
    });

    applyOperation(model, moment, labelManager);

    expect(model.customerPoints.get(IDS.CP1)!.label).toBe("new");
    expect(labelManager.isLabelAvailable("new", "customerPoint")).toBe(false);
    expect(labelManager.isLabelAvailable("old", "customerPoint")).toBe(true);

    const connected = getActiveCustomerPoints(
      model.customerPointsLookup,
      model.assets,
      IDS.J1,
    );
    expect(connected.map((cp) => cp.label)).toEqual(["new"]);
  });

  it("restores the previous label on undo", () => {
    const { labelManager } = buildTestFactories();
    const model = buildConnectedModel(labelManager);

    const forward = changeCustomerPointProperty(model, {
      customerPointIds: [IDS.CP1],
      property: "label",
      value: "new",
    });
    const { undo } = applyOperation(model, forward, labelManager);

    undo();

    expect(model.customerPoints.get(IDS.CP1)!.label).toBe("old");
    expect(labelManager.isLabelAvailable("old", "customerPoint")).toBe(false);
  });

  it("does not mutate the original customer point object", () => {
    const { labelManager } = buildTestFactories();
    const model = buildConnectedModel(labelManager);
    const original = model.customerPoints.get(IDS.CP1)!;

    const moment = changeCustomerPointProperty(model, {
      customerPointIds: [IDS.CP1],
      property: "label",
      value: "new",
    });
    applyOperation(model, moment, labelManager);

    expect(original.label).toBe("old");
    expect(model.customerPoints.get(IDS.CP1)).not.toBe(original);
  });
});
