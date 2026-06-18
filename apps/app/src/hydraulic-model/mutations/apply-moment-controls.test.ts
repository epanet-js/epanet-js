import { describe, it, expect } from "vitest";
import { getLinkTimedSetting } from "@epanet-js/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { applyMomentToModel } from "./apply-moment";
import { ModelMoment } from "../model-operation";
import { buildTestFactories } from "src/__helpers__/test-factories";

describe("applyMomentToModel with putControls", () => {
  const IDS = { N1: 1, N2: 2, P1: 3 } as const;

  const aModel = (
    labelManager: ReturnType<typeof buildTestFactories>["labelManager"],
  ) =>
    HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.N1)
      .aJunction(IDS.N2)
      .aPump(IDS.P1, { startNodeId: IDS.N1, endNodeId: IDS.N2 })
      .build();

  it("applies controls and returns the previous controls in the reverse moment", () => {
    const { labelManager } = buildTestFactories();
    const model = aModel(labelManager);

    const moment: ModelMoment = {
      note: "Change controls",
      putControls: [
        {
          type: "timed-setting",
          linkId: IDS.P1,
          steps: [
            { time: 3600, status: "off", setting: 1 },
            { time: 7200, status: "on", setting: 1.5 },
          ],
        },
      ],
    };

    const reverse = applyMomentToModel(model, moment, labelManager);

    expect(getLinkTimedSetting(model.controls, IDS.P1)?.steps).toEqual([
      { time: 3600, status: "off", setting: 1 },
      { time: 7200, status: "on", setting: 1.5 },
    ]);
    expect(reverse.putControls).toEqual([]);
  });

  it("round-trips through the reverse moment (undo)", () => {
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.N1)
      .aJunction(IDS.N2)
      .aPump(IDS.P1, { startNodeId: IDS.N1, endNodeId: IDS.N2 })
      .aTimedSettingControl({
        linkId: IDS.P1,
        steps: [{ time: 3600, status: "off", setting: 1 }],
      })
      .build();

    const moment: ModelMoment = {
      note: "Change controls",
      putControls: [],
    };

    const reverse = applyMomentToModel(model, moment, labelManager);
    expect(model.controls).toEqual([]);

    applyMomentToModel(model, reverse, labelManager);
    expect(getLinkTimedSetting(model.controls, IDS.P1)?.steps).toEqual([
      { time: 3600, status: "off", setting: 1 },
    ]);
  });
});
