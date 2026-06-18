import {
  buildDefaultLevelSetting,
  createEmptyControls,
  getLinkLevelSetting,
  getLinkTimedSetting,
  setAssetControl,
  setLinkTimedSetting,
} from "./types";

describe("controls helpers", () => {
  const IDS = { P1: 7, P2: 8 } as const;

  describe("getLinkTimedSetting", () => {
    it("returns null when no control exists for the link", () => {
      expect(getLinkTimedSetting(createEmptyControls(), IDS.P1)).toBeNull();
    });

    it("returns the timed-setting control for the link", () => {
      const controls = setLinkTimedSetting(createEmptyControls(), IDS.P1, [
        { time: 3600, status: "off", setting: 1 },
      ]);
      expect(getLinkTimedSetting(controls, IDS.P1)).toEqual({
        type: "timed-setting",
        linkId: IDS.P1,
        steps: [{ time: 3600, status: "off", setting: 1 }],
      });
    });
  });

  describe("setLinkTimedSetting", () => {
    it("adds a control for a link", () => {
      const controls = setLinkTimedSetting(createEmptyControls(), IDS.P1, [
        { time: 3600, status: "off", setting: 1 },
        { time: 7200, status: "on", setting: 1.5 },
      ]);
      expect(controls).toHaveLength(1);
    });

    it("adds a control with no extra steps (time-based enabled)", () => {
      const controls = setLinkTimedSetting(createEmptyControls(), IDS.P1, []);
      expect(getLinkTimedSetting(controls, IDS.P1)).toEqual({
        type: "timed-setting",
        linkId: IDS.P1,
        steps: [],
      });
    });

    it("replaces the control for the same link without touching others", () => {
      const initial = setLinkTimedSetting(
        setLinkTimedSetting(createEmptyControls(), IDS.P1, [
          { time: 3600, status: "off", setting: 1 },
        ]),
        IDS.P2,
        [{ time: 3600, status: "on", setting: 1 }],
      );

      const updated = setLinkTimedSetting(initial, IDS.P1, [
        { time: 7200, status: "on", setting: 2 },
      ]);

      expect(updated).toHaveLength(2);
      expect(getLinkTimedSetting(updated, IDS.P1)?.steps).toEqual([
        { time: 7200, status: "on", setting: 2 },
      ]);
      expect(getLinkTimedSetting(updated, IDS.P2)?.steps).toEqual([
        { time: 3600, status: "on", setting: 1 },
      ]);
    });

    it("removes the control when steps is null", () => {
      const initial = setLinkTimedSetting(createEmptyControls(), IDS.P1, [
        { time: 3600, status: "off", setting: 1 },
      ]);
      const updated = setLinkTimedSetting(initial, IDS.P1, null);
      expect(updated).toHaveLength(0);
    });

    it("does not mutate the input controls", () => {
      const initial = createEmptyControls();
      setLinkTimedSetting(initial, IDS.P1, [
        { time: 3600, status: "off", setting: 1 },
      ]);
      expect(initial).toHaveLength(0);
    });
  });

  describe("buildDefaultLevelSetting", () => {
    it("builds a level control from tank min/max and the initial speed", () => {
      expect(buildDefaultLevelSetting(IDS.P1, 12, 2, 9, 1.5)).toEqual({
        type: "level-setting",
        linkId: IDS.P1,
        tankId: 12,
        on: { level: 2, setting: 1.5 },
        off: { level: 9 },
      });
    });
  });

  describe("getLinkLevelSetting", () => {
    it("returns null when no level control exists for the link", () => {
      expect(getLinkLevelSetting(createEmptyControls(), IDS.P1)).toBeNull();
    });

    it("returns the level-setting control for the link", () => {
      const control = buildDefaultLevelSetting(IDS.P1, 12, 2, 9, 1.5);
      const controls = setAssetControl(createEmptyControls(), IDS.P1, control);
      expect(getLinkLevelSetting(controls, IDS.P1)).toEqual(control);
    });

    it("does not return a timed-setting control", () => {
      const controls = setLinkTimedSetting(createEmptyControls(), IDS.P1, []);
      expect(getLinkLevelSetting(controls, IDS.P1)).toBeNull();
    });
  });

  describe("setAssetControl across control types", () => {
    it("replaces a timed control with a level control on the same link", () => {
      const timed = setLinkTimedSetting(createEmptyControls(), IDS.P1, [
        { time: 3600, status: "off", setting: 1 },
      ]);
      const level = buildDefaultLevelSetting(IDS.P1, 12, 2, 9, 1.5);
      const updated = setAssetControl(timed, IDS.P1, level);
      expect(updated).toHaveLength(1);
      expect(getLinkTimedSetting(updated, IDS.P1)).toBeNull();
      expect(getLinkLevelSetting(updated, IDS.P1)).toEqual(level);
    });
  });
});
