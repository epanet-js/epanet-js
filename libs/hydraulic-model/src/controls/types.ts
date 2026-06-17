import { AssetId } from "../asset-types";
import { PumpStatus } from "../asset-types/pump";

export type TimedSettingStep = {
  time: number;
  status: PumpStatus;
  speed: number;
};

export type TimedSettingControl = {
  type: "timed-setting";
  linkId: AssetId;
  steps: TimedSettingStep[];
};

export type Control = TimedSettingControl;

export type Controls = Control[];

export const createEmptyControls = (): Controls => [];

export const getLinkTimedSetting = (
  controls: Controls,
  linkId: AssetId,
): TimedSettingControl | null =>
  controls.find(
    (control): control is TimedSettingControl =>
      control.type === "timed-setting" && control.linkId === linkId,
  ) ?? null;

export const setLinkTimedSetting = (
  controls: Controls,
  linkId: AssetId,
  steps: TimedSettingStep[] | null,
): Controls => {
  const others = controls.filter(
    (control) =>
      !(control.type === "timed-setting" && control.linkId === linkId),
  );
  if (steps === null) return others;
  return [...others, { type: "timed-setting", linkId, steps }];
};
