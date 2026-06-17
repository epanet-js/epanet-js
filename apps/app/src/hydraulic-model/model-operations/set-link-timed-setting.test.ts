import { getLinkTimedSetting } from "@epanet-js/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setLinkTimedSetting } from "./set-link-timed-setting";

describe("setLinkTimedSetting", () => {
  const IDS = { J1: 1, J2: 2, P1: 3 } as const;

  const aModel = () =>
    HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPump(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

  it("creates a timed-setting control for the link", () => {
    const hydraulicModel = aModel();

    const { putControls } = setLinkTimedSetting(hydraulicModel, {
      linkId: IDS.P1,
      steps: [
        { time: 3600, status: "off", speed: 1 },
        { time: 7200, status: "on", speed: 1.5 },
      ],
    });

    expect(putControls).toBeDefined();
    expect(getLinkTimedSetting(putControls!, IDS.P1)?.steps).toEqual([
      { time: 3600, status: "off", speed: 1 },
      { time: 7200, status: "on", speed: 1.5 },
    ]);
  });

  it("removes the control when steps is null", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPump(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aTimedSettingControl({
        linkId: IDS.P1,
        steps: [{ time: 3600, status: "off", speed: 1 }],
      })
      .build();

    const { putControls } = setLinkTimedSetting(hydraulicModel, {
      linkId: IDS.P1,
      steps: null,
    });

    expect(getLinkTimedSetting(putControls!, IDS.P1)).toBeNull();
  });
});
