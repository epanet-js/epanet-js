import { describe, it, expect } from "vitest";
import { getLinkTimedSetting } from "@epanet-js/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { applyOperation } from "src/__helpers__/apply-operation";
import { ModelMoment } from "../model-operation";
import { buildTestFactories } from "src/__helpers__/test-factories";

describe("change sets from putControls", () => {
  const IDS = { N1: 1, N2: 2, P1: 3, T1: 4 } as const;

  const aModel = (
    labelManager: ReturnType<typeof buildTestFactories>["labelManager"],
  ) =>
    HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.N1)
      .aJunction(IDS.N2)
      .aPump(IDS.P1, { startNodeId: IDS.N1, endNodeId: IDS.N2 })
      .build();

  const aModelWithTimedControl = (
    labelManager: ReturnType<typeof buildTestFactories>["labelManager"],
  ) =>
    HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.N1)
      .aJunction(IDS.N2)
      .aPump(IDS.P1, { startNodeId: IDS.N1, endNodeId: IDS.N2 })
      .aTimedSettingControl({
        linkId: IDS.P1,
        steps: [{ time: 3600, status: "off", setting: 1 }],
      })
      .build();

  it("applies controls and removes them on undo", () => {
    const { labelManager } = buildTestFactories();
    const model = aModel(labelManager);

    const moment: ModelMoment = {
      note: "Change controls",
      putControls: [
        {
          id: "ctrl-1",
          type: "timed-setting",
          linkId: IDS.P1,
          steps: [
            { time: 3600, status: "off", setting: 1 },
            { time: 7200, status: "on", setting: 1.5 },
          ],
        },
      ],
    };

    const { undo } = applyOperation(model, moment, labelManager);

    expect(getLinkTimedSetting(model.controls, IDS.P1)?.steps).toEqual([
      { time: 3600, status: "off", setting: 1 },
      { time: 7200, status: "on", setting: 1.5 },
    ]);

    undo();
    expect(model.controls).toEqual([]);
  });

  it("round-trips a removal through undo", () => {
    const { labelManager } = buildTestFactories();
    const model = aModelWithTimedControl(labelManager);

    const { undo } = applyOperation(
      model,
      { note: "Change controls", putControls: [] },
      labelManager,
    );
    expect(model.controls).toEqual([]);

    undo();
    expect(getLinkTimedSetting(model.controls, IDS.P1)?.steps).toEqual([
      { time: 3600, status: "off", setting: 1 },
    ]);
  });

  it("rebuilds the controls lookup when applying putControls", () => {
    const { labelManager } = buildTestFactories();
    const model = aModel(labelManager);

    const control = {
      id: "ctrl-1",
      type: "level-setting" as const,
      linkId: IDS.P1,
      tankId: IDS.T1,
      on: { level: 1, setting: 1 },
      off: { level: 5 },
    };

    applyOperation(
      model,
      { note: "Change controls", putControls: [control] },
      labelManager,
    );

    expect(model.controlsLookup.getControls(IDS.P1)).toEqual(
      new Set([control]),
    );
    expect(model.controlsLookup.getControls(IDS.T1)).toEqual(
      new Set([control]),
    );
  });

  it("restores the lookup on undo", () => {
    const { labelManager } = buildTestFactories();
    const model = aModelWithTimedControl(labelManager);

    const { undo } = applyOperation(
      model,
      { note: "Change controls", putControls: [] },
      labelManager,
    );
    expect(model.controlsLookup.hasControls(IDS.P1)).toBe(false);

    undo();
    expect(model.controlsLookup.hasControls(IDS.P1)).toBe(true);
  });
});
