import { AssetId } from "../asset-types";
import {
  Control,
  Controls,
  PumpControl,
  ValveControl,
  isPumpControl,
  isValveControl,
} from "./types";

export class ControlsLookup {
  private lookup: Map<AssetId, Set<Control>> = new Map();

  addControl(control: Control): void {
    for (const assetId of referencedIds(control)) {
      this.index(assetId, control);
    }
  }

  removeControl(control: Control): void {
    for (const assetId of referencedIds(control)) {
      this.unindex(assetId, control);
    }
  }

  getControls(assetId: AssetId): Set<Control> {
    return this.lookup.get(assetId) || new Set();
  }

  hasControls(assetId: AssetId): boolean {
    return this.lookup.has(assetId);
  }

  clear(): void {
    this.lookup.clear();
  }

  copy(): ControlsLookup {
    const next = new ControlsLookup();
    const seen = new Set<Control>();
    for (const [, controls] of this.lookup.entries()) {
      for (const control of controls) {
        if (!seen.has(control)) {
          seen.add(control);
          next.addControl(control);
        }
      }
    }
    return next;
  }

  entries(): IterableIterator<[AssetId, Set<Control>]> {
    return this.lookup.entries();
  }

  private index(assetId: AssetId, control: Control): void {
    if (!this.lookup.has(assetId)) {
      this.lookup.set(assetId, new Set());
    }
    this.lookup.get(assetId)!.add(control);
  }

  private unindex(assetId: AssetId, control: Control): void {
    const controls = this.lookup.get(assetId);
    if (!controls) return;
    controls.delete(control);
    if (controls.size === 0) {
      this.lookup.delete(assetId);
    }
  }
}

export const buildControlsLookup = (controls: Controls): ControlsLookup => {
  const lookup = new ControlsLookup();
  for (const control of controls) {
    lookup.addControl(control);
  }
  return lookup;
};

export const getPumpControl = (
  lookup: ControlsLookup,
  pumpId: AssetId,
): PumpControl | null => {
  for (const control of lookup.getControls(pumpId)) {
    if (control.linkId === pumpId && isPumpControl(control)) return control;
  }
  return null;
};

export const getValveControl = (
  lookup: ControlsLookup,
  valveId: AssetId,
): ValveControl | null => {
  for (const control of lookup.getControls(valveId)) {
    if (control.linkId === valveId && isValveControl(control)) return control;
  }
  return null;
};

const referencedIds = (control: Control): AssetId[] => {
  switch (control.type) {
    case "timed-setting":
      return [control.linkId];
    case "level-setting":
      return [control.linkId, control.tankId];
    case "variable-speed-pump":
      return [
        control.linkId,
        control.targetId,
        ...(control.tankLevels ? [control.tankLevels.tankId] : []),
        ...control.laggedPumpIds,
      ];
    case "flow-modulating-valve":
      return [control.linkId, control.sensorLinkId, control.controlNodeId];
  }
};
