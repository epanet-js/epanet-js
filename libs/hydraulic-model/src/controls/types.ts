import { AssetId } from "../asset-types";
import { PumpStatus } from "../asset-types/pump";

export type TimedSettingStep = {
  time: number;
  status: PumpStatus;
  setting: number;
};

export type TimedSettingControl = {
  type: "timed-setting";
  linkId: AssetId;
  steps: TimedSettingStep[];
};

export type LevelSettingControl = {
  type: "level-setting";
  linkId: AssetId;
  tankId: AssetId;
  on: { level: number; setting: number };
  off: { level: number };
};

export type Control = TimedSettingControl | LevelSettingControl;

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

export const getLinkLevelSetting = (
  controls: Controls,
  linkId: AssetId,
): LevelSettingControl | null =>
  controls.find(
    (control): control is LevelSettingControl =>
      control.type === "level-setting" && control.linkId === linkId,
  ) ?? null;

export const buildDefaultLevelSetting = (
  linkId: AssetId,
  tankId: AssetId,
  minLevel: number,
  maxLevel: number,
  initialSpeed: number,
): LevelSettingControl => ({
  type: "level-setting",
  linkId,
  tankId,
  on: { level: minLevel, setting: initialSpeed },
  off: { level: maxLevel },
});

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

export const setAssetControl = (
  controls: Controls,
  assetId: AssetId,
  control: Control | null,
): Controls => {
  const others = controls.filter((c) => c.linkId !== assetId);
  if (control === null) return others;
  return [...others, control];
};
