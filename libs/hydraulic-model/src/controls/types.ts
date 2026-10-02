import { nanoid } from "nanoid";

import { AssetId, NodeAsset } from "../asset-types";
import { PumpStatus } from "../asset-types/pump";

export type ControlId = string;

export const createControlId = (): ControlId => nanoid();

export type TimedSettingStep = {
  time: number;
  status: PumpStatus;
  setting: number;
};

export type TimedSettingControl = {
  id: ControlId;
  type: "timed-setting";
  linkId: AssetId;
  steps: TimedSettingStep[];
};

export type LevelSettingControl = {
  id: ControlId;
  type: "level-setting";
  linkId: AssetId;
  tankId: AssetId;
  on: { level: number; setting: number };
  off: { level: number };
};

export type VariableSpeedPumpSchedulePoint = {
  time: number;
  target: number;
};

export type VariableSpeedPumpTankLevels = {
  tankId: AssetId;
  offLevel: number;
  onLevel: number;
};

export type VariableSpeedPumpControl = {
  id: ControlId;
  type: "variable-speed-pump";
  linkId: AssetId;
  quantity: "pressure" | "level" | "flow";
  targetId: AssetId;
  target: number;
  minSpeed: number;
  maxSpeed: number;
  laggedPumpIds: AssetId[];
  schedule: VariableSpeedPumpSchedulePoint[];
  tankLevels?: VariableSpeedPumpTankLevels;
};

export type Control =
  | TimedSettingControl
  | LevelSettingControl
  | VariableSpeedPumpControl;

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

export const getLinkVariableSpeedPump = (
  controls: Controls,
  linkId: AssetId,
): VariableSpeedPumpControl | null =>
  controls.find(
    (control): control is VariableSpeedPumpControl =>
      control.type === "variable-speed-pump" && control.linkId === linkId,
  ) ?? null;

export const buildTimedSetting = (
  linkId: AssetId,
  steps: TimedSettingStep[],
  id: ControlId = createControlId(),
): TimedSettingControl => ({
  id,
  type: "timed-setting",
  linkId,
  steps,
});

export const buildDefaultLevelSetting = (
  linkId: AssetId,
  tankId: AssetId,
  minLevel: number,
  maxLevel: number,
  initialSpeed: number,
  id: ControlId = createControlId(),
): LevelSettingControl => ({
  id,
  type: "level-setting",
  linkId,
  tankId,
  on: { level: minLevel, setting: initialSpeed },
  off: { level: maxLevel },
});

export const buildVariableSpeedPump = (
  data: Omit<VariableSpeedPumpControl, "id" | "type">,
  id: ControlId = createControlId(),
): VariableSpeedPumpControl => ({
  id,
  type: "variable-speed-pump",
  ...data,
});

export const buildDefaultVspPressureControl = (
  linkId: AssetId,
  outletNode: NodeAsset,
  base?: VariableSpeedPumpControl,
  id: ControlId = createControlId(),
): VariableSpeedPumpControl => {
  const isTank = outletNode.type === "tank";
  const keepsTankLevels = isTank && base?.tankLevels?.tankId === outletNode.id;
  return {
    id,
    type: "variable-speed-pump",
    linkId,
    quantity: isTank ? "level" : "pressure",
    targetId: outletNode.id,
    target: 0,
    minSpeed: base?.minSpeed ?? 0,
    maxSpeed: base?.maxSpeed ?? 1,
    laggedPumpIds: base?.laggedPumpIds ?? [],
    schedule: [],
    ...(keepsTankLevels && { tankLevels: base.tankLevels }),
  };
};

export const buildDefaultVspFlowControl = (
  linkId: AssetId,
  base?: VariableSpeedPumpControl,
  id: ControlId = createControlId(),
): VariableSpeedPumpControl => ({
  id,
  type: "variable-speed-pump",
  linkId,
  quantity: "flow",
  targetId: linkId,
  target: 0,
  minSpeed: base?.minSpeed ?? 0,
  maxSpeed: base?.maxSpeed ?? 1,
  laggedPumpIds: base?.laggedPumpIds ?? [],
  schedule: [],
  ...(base?.tankLevels && { tankLevels: base.tankLevels }),
});

export const setAssetControl = (
  controls: Controls,
  assetId: AssetId,
  control: Control | null,
): Controls => {
  const others = controls.filter((c) => c.linkId !== assetId);
  if (control === null) return others;
  return [...others, control];
};
