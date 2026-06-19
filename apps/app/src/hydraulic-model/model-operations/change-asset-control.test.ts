import {
  Control,
  getLinkLevelSetting,
  getLinkTimedSetting,
} from "@epanet-js/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { changeAssetControl } from "./change-asset-control";

describe("changeAssetControl", () => {
  const IDS = { J1: 1, J2: 2, P1: 3, P2: 4 } as const;

  const aModel = () =>
    HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPump(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPump(IDS.P2, { startNodeId: IDS.J1, endNodeId: IDS.J2 });

  it("assigns a control to the asset", () => {
    const hydraulicModel = aModel().build();
    const control: Control = {
      id: "ctrl-1",
      type: "timed-setting",
      linkId: IDS.P1,
      steps: [{ time: 3600, status: "off", setting: 1 }],
    };

    const { putControls } = changeAssetControl(hydraulicModel, {
      assetId: IDS.P1,
      control,
    });

    expect(getLinkTimedSetting(putControls!, IDS.P1)?.steps).toEqual([
      { time: 3600, status: "off", setting: 1 },
    ]);
  });

  it("replaces an existing control for the same asset", () => {
    const hydraulicModel = aModel()
      .aTimedSettingControl({
        linkId: IDS.P1,
        steps: [{ time: 3600, status: "off", setting: 1 }],
      })
      .build();

    const { putControls } = changeAssetControl(hydraulicModel, {
      assetId: IDS.P1,
      control: {
        id: "ctrl-1",
        type: "timed-setting",
        linkId: IDS.P1,
        steps: [{ time: 7200, status: "on", setting: 1.5 }],
      },
    });

    expect(putControls!.filter((c) => c.linkId === IDS.P1)).toHaveLength(1);
    expect(getLinkTimedSetting(putControls!, IDS.P1)?.steps).toEqual([
      { time: 7200, status: "on", setting: 1.5 },
    ]);
  });

  it("leaves controls for other assets intact", () => {
    const hydraulicModel = aModel()
      .aTimedSettingControl({
        linkId: IDS.P2,
        steps: [{ time: 3600, status: "off", setting: 1 }],
      })
      .build();

    const { putControls } = changeAssetControl(hydraulicModel, {
      assetId: IDS.P1,
      control: {
        id: "ctrl-1",
        type: "timed-setting",
        linkId: IDS.P1,
        steps: [{ time: 7200, status: "on", setting: 1.5 }],
      },
    });

    expect(getLinkTimedSetting(putControls!, IDS.P2)?.steps).toEqual([
      { time: 3600, status: "off", setting: 1 },
    ]);
  });

  it("replaces a timed control with a level control on the same asset", () => {
    const hydraulicModel = aModel()
      .aTimedSettingControl({
        linkId: IDS.P1,
        steps: [{ time: 3600, status: "off", setting: 1 }],
      })
      .build();

    const { putControls } = changeAssetControl(hydraulicModel, {
      assetId: IDS.P1,
      control: {
        id: "ctrl-1",
        type: "level-setting",
        linkId: IDS.P1,
        tankId: 9,
        on: { level: 2, setting: 1.5 },
        off: { level: 9 },
      },
    });

    expect(putControls!.filter((c) => c.linkId === IDS.P1)).toHaveLength(1);
    expect(getLinkTimedSetting(putControls!, IDS.P1)).toBeNull();
    expect(getLinkLevelSetting(putControls!, IDS.P1)).toEqual({
      id: "ctrl-1",
      type: "level-setting",
      linkId: IDS.P1,
      tankId: 9,
      on: { level: 2, setting: 1.5 },
      off: { level: 9 },
    });
  });

  it("clears the control when control is null", () => {
    const hydraulicModel = aModel()
      .aTimedSettingControl({
        linkId: IDS.P1,
        steps: [{ time: 3600, status: "off", setting: 1 }],
      })
      .build();

    const { putControls } = changeAssetControl(hydraulicModel, {
      assetId: IDS.P1,
      control: null,
    });

    expect(getLinkTimedSetting(putControls!, IDS.P1)).toBeNull();
  });
});
