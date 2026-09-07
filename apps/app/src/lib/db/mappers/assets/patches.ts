import { z } from "zod";
import type { AssetPatch } from "src/hydraulic-model/model-operation";
import { type AssetId } from "@epanet-js/hydraulic-model";
import {
  junctionPatchRowSchema,
  reservoirPatchRowSchema,
  tankPatchRowSchema,
  pipePatchRowSchema,
  pumpPatchRowSchema,
  valvePatchRowSchema,
  emptyAssetPatchRows,
  patchFrom,
  junctionMap,
  reservoirMap,
  tankMap,
  pipeMap,
  pumpMap,
  valveMap,
  type AssetPatchRows,
} from "@epanet-js/ejsdb";

export { emptyAssetPatchRows, type AssetPatchRows } from "@epanet-js/ejsdb";

export const assetPatchesToRows = (
  patches: readonly AssetPatch[],
): AssetPatchRows => {
  const rows = emptyAssetPatchRows();
  for (const patch of patches) {
    switch (patch.type) {
      case "junction":
        rows.junctions.push(
          parsePatch(
            junctionPatchRowSchema,
            patchFrom(patch.id, patch.properties, junctionMap),
            "Junction",
            patch.id,
          ),
        );
        break;
      case "reservoir":
        rows.reservoirs.push(
          parsePatch(
            reservoirPatchRowSchema,
            patchFrom(patch.id, patch.properties, reservoirMap),
            "Reservoir",
            patch.id,
          ),
        );
        break;
      case "tank":
        rows.tanks.push(
          parsePatch(
            tankPatchRowSchema,
            patchFrom(patch.id, patch.properties, tankMap),
            "Tank",
            patch.id,
          ),
        );
        break;
      case "pipe":
        rows.pipes.push(
          parsePatch(
            pipePatchRowSchema,
            patchFrom(patch.id, patch.properties, pipeMap),
            "Pipe",
            patch.id,
          ),
        );
        break;
      case "pump":
        rows.pumps.push(
          parsePatch(
            pumpPatchRowSchema,
            patchFrom(patch.id, patch.properties, pumpMap),
            "Pump",
            patch.id,
          ),
        );
        break;
      case "valve":
        rows.valves.push(
          parsePatch(
            valvePatchRowSchema,
            patchFrom(patch.id, patch.properties, valveMap),
            "Valve",
            patch.id,
          ),
        );
        break;
    }
  }
  return rows;
};

const parsePatch = <T>(
  schema: z.ZodType<T>,
  patch: Record<string, unknown>,
  kind: string,
  id: AssetId,
): T => {
  const result = schema.safeParse(patch);
  if (!result.success) {
    throw new Error(
      `${kind} ${id} patch: row does not match schema — ${result.error.message}`,
    );
  }
  return result.data;
};
