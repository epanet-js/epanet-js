import { AssetId } from "../asset-types";
import { Control, Controls } from "./types";

export class ControlsLookup {
  private lookup: Map<AssetId, Set<Control>> = new Map();

  addControl(control: Control): void {
    this.index(control.linkId, control);
    if (control.type === "level-setting") {
      this.index(control.tankId, control);
    }
  }

  removeControl(control: Control): void {
    this.unindex(control.linkId, control);
    if (control.type === "level-setting") {
      this.unindex(control.tankId, control);
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
