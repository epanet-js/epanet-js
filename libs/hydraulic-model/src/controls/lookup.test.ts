import { expect, describe, it } from "vitest";
import { ControlsLookup, buildControlsLookup } from "./lookup";
import { LevelSettingControl, TimedSettingControl, Controls } from "./types";

const aTimedControl = (id: string, linkId: number): TimedSettingControl => ({
  id,
  type: "timed-setting",
  linkId,
  steps: [{ time: 3600, status: "off", setting: 1 }],
});

const aLevelControl = (
  id: string,
  linkId: number,
  tankId: number,
): LevelSettingControl => ({
  id,
  type: "level-setting",
  linkId,
  tankId,
  on: { level: 1, setting: 1 },
  off: { level: 5 },
});

describe("ControlsLookup", () => {
  it("finds a level-setting control by both its link and its tank", () => {
    const IDS = { P1: 1, T1: 2 } as const;
    const lookup = new ControlsLookup();
    const control = aLevelControl("ctrl-1", IDS.P1, IDS.T1);

    lookup.addControl(control);

    expect(lookup.getControls(IDS.P1)).toEqual(new Set([control]));
    expect(lookup.getControls(IDS.T1)).toEqual(new Set([control]));
  });

  it("finds a timed-setting control by its link only", () => {
    const IDS = { P1: 1 } as const;
    const lookup = new ControlsLookup();
    const control = aTimedControl("ctrl-1", IDS.P1);

    lookup.addControl(control);

    expect(lookup.getControls(IDS.P1)).toEqual(new Set([control]));
  });

  it("returns every control that depends on the same tank", () => {
    const IDS = { P1: 1, P2: 2, T1: 3 } as const;
    const lookup = new ControlsLookup();
    const control1 = aLevelControl("ctrl-1", IDS.P1, IDS.T1);
    const control2 = aLevelControl("ctrl-2", IDS.P2, IDS.T1);

    lookup.addControl(control1);
    lookup.addControl(control2);

    expect(lookup.getControls(IDS.T1)).toEqual(new Set([control1, control2]));
    expect(lookup.getControls(IDS.P1)).toEqual(new Set([control1]));
    expect(lookup.getControls(IDS.P2)).toEqual(new Set([control2]));
  });

  it("removes a control from both its link and its tank index", () => {
    const IDS = { P1: 1, T1: 2 } as const;
    const lookup = new ControlsLookup();
    const control = aLevelControl("ctrl-1", IDS.P1, IDS.T1);

    lookup.addControl(control);
    lookup.removeControl(control);

    expect(lookup.hasControls(IDS.P1)).toBe(false);
    expect(lookup.hasControls(IDS.T1)).toBe(false);
    expect(lookup.getControls(IDS.P1)).toEqual(new Set());
  });

  it("keeps other controls when removing one that shares a tank", () => {
    const IDS = { P1: 1, P2: 2, T1: 3 } as const;
    const lookup = new ControlsLookup();
    const control1 = aLevelControl("ctrl-1", IDS.P1, IDS.T1);
    const control2 = aLevelControl("ctrl-2", IDS.P2, IDS.T1);

    lookup.addControl(control1);
    lookup.addControl(control2);
    lookup.removeControl(control1);

    expect(lookup.getControls(IDS.T1)).toEqual(new Set([control2]));
    expect(lookup.hasControls(IDS.P1)).toBe(false);
  });

  it("does not crash when removing a missing control", () => {
    const IDS = { P1: 1, T1: 2 } as const;
    const lookup = new ControlsLookup();

    expect(() =>
      lookup.removeControl(aLevelControl("ctrl-1", IDS.P1, IDS.T1)),
    ).not.toThrow();
  });

  it("builds a lookup from a controls array", () => {
    const IDS = { P1: 1, P2: 2, T1: 3 } as const;
    const control1 = aTimedControl("ctrl-1", IDS.P1);
    const control2 = aLevelControl("ctrl-2", IDS.P2, IDS.T1);
    const controls: Controls = [control1, control2];

    const lookup = buildControlsLookup(controls);

    expect(lookup.getControls(IDS.P1)).toEqual(new Set([control1]));
    expect(lookup.getControls(IDS.P2)).toEqual(new Set([control2]));
    expect(lookup.getControls(IDS.T1)).toEqual(new Set([control2]));
  });

  it("copies into an independent lookup", () => {
    const IDS = { P1: 1, T1: 2 } as const;
    const lookup = new ControlsLookup();
    const control = aLevelControl("ctrl-1", IDS.P1, IDS.T1);
    lookup.addControl(control);

    const copy = lookup.copy();
    lookup.removeControl(control);

    expect(copy.getControls(IDS.P1)).toEqual(new Set([control]));
    expect(copy.getControls(IDS.T1)).toEqual(new Set([control]));
    expect(lookup.hasControls(IDS.P1)).toBe(false);
  });

  it("can clear all controls", () => {
    const IDS = { P1: 1, T1: 2 } as const;
    const lookup = new ControlsLookup();
    lookup.addControl(aLevelControl("ctrl-1", IDS.P1, IDS.T1));

    lookup.clear();

    expect(lookup.hasControls(IDS.P1)).toBe(false);
    expect(lookup.hasControls(IDS.T1)).toBe(false);
  });
});
