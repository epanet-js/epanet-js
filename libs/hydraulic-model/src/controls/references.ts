import { AssetId, LinkAsset, NodeAsset } from "../asset-types";
import { AssetsMap } from "../assets-map";
import {
  Control,
  Controls,
  VariableSpeedPumpControl,
  buildDefaultVspFlowControl,
  buildDefaultVspPressureControl,
} from "./types";

export const detachControlReferences = (
  controls: Controls,
  removedIds: ReadonlySet<AssetId>,
  assets: AssetsMap,
): Controls | null => {
  let changed = false;
  const next: Controls = [];
  for (const control of controls) {
    const detached = detachControl(control, removedIds, assets);
    if (detached !== control) changed = true;
    if (detached) next.push(detached);
  }
  return changed ? next : null;
};

const detachControl = (
  control: Control,
  removedIds: ReadonlySet<AssetId>,
  assets: AssetsMap,
): Control | null => {
  if (removedIds.has(control.linkId)) return null;
  switch (control.type) {
    case "timed-setting":
      return control;
    case "level-setting":
      return removedIds.has(control.tankId) ? null : control;
    case "variable-speed-pump":
      return detachVariableSpeedPump(control, removedIds, assets);
  }
};

const detachVariableSpeedPump = (
  control: VariableSpeedPumpControl,
  removedIds: ReadonlySet<AssetId>,
  assets: AssetsMap,
): VariableSpeedPumpControl | null => {
  let next = control;
  if (removedIds.has(next.targetId)) {
    const fallback = defaultTargetOf(next, removedIds, assets);
    if (!fallback) return null;
    next = fallback;
  }
  if (next.tankLevels && removedIds.has(next.tankLevels.tankId)) {
    next = withoutTankLevels(next);
  }
  if (next.laggedPumpIds.some((id) => removedIds.has(id))) {
    next = {
      ...next,
      laggedPumpIds: next.laggedPumpIds.filter((id) => !removedIds.has(id)),
    };
  }
  return next;
};

const defaultTargetOf = (
  control: VariableSpeedPumpControl,
  removedIds: ReadonlySet<AssetId>,
  assets: AssetsMap,
): VariableSpeedPumpControl | null => {
  if (control.quantity === "flow") {
    return buildDefaultVspFlowControl(control.linkId, control, control.id);
  }
  const outlet = outletOf(control.linkId, removedIds, assets);
  if (!outlet) return null;
  return buildDefaultVspPressureControl(
    control.linkId,
    outlet,
    control,
    control.id,
  );
};

const outletOf = (
  linkId: AssetId,
  removedIds: ReadonlySet<AssetId>,
  assets: AssetsMap,
): NodeAsset | null => {
  const link = assets.get(linkId);
  if (!link || !link.isLink) return null;
  const outletId = (link as LinkAsset).connections[1];
  if (removedIds.has(outletId)) return null;
  const outlet = assets.get(outletId);
  return outlet && outlet.isNode ? (outlet as NodeAsset) : null;
};

const withoutTankLevels = (
  control: VariableSpeedPumpControl,
): VariableSpeedPumpControl => {
  const next = { ...control };
  delete next.tankLevels;
  return next;
};
