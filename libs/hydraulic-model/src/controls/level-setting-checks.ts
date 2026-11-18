export type LevelSettingError = "onOutOfRange" | "offOutOfRange" | "order";

export const validateLevelSetting = (params: {
  onLevel: number;
  offLevel: number;
  minLevel: number;
  maxLevel: number;
}): LevelSettingError[] => {
  const { onLevel, offLevel, minLevel, maxLevel } = params;
  const errors: LevelSettingError[] = [];
  const inRange = (value: number) => value >= minLevel && value <= maxLevel;
  if (!inRange(onLevel)) errors.push("onOutOfRange");
  if (!inRange(offLevel)) errors.push("offOutOfRange");
  if (onLevel >= offLevel) errors.push("order");
  return errors;
};
