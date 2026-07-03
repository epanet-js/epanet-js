import { z } from "zod";
import {
  junctionRowSchema,
  reservoirRowSchema,
  tankRowSchema,
  pipeRowSchema,
  pumpRowSchema,
  valveRowSchema,
} from "./assets";
import { customerPointRowSchema } from "./customer-points";

const asPatchSchema = <T extends z.ZodObject<z.ZodRawShape>>(rowSchema: T) =>
  rowSchema.partial().required({ id: true });

export const junctionPatchRowSchema = asPatchSchema(junctionRowSchema);
export const reservoirPatchRowSchema = asPatchSchema(reservoirRowSchema);
export const tankPatchRowSchema = asPatchSchema(tankRowSchema);
export const pipePatchRowSchema = asPatchSchema(pipeRowSchema);
export const pumpPatchRowSchema = asPatchSchema(pumpRowSchema);
export const valvePatchRowSchema = asPatchSchema(valveRowSchema);
export const customerPointPatchRowSchema = asPatchSchema(
  customerPointRowSchema,
);

export type JunctionPatchRow = z.infer<typeof junctionPatchRowSchema>;
export type ReservoirPatchRow = z.infer<typeof reservoirPatchRowSchema>;
export type TankPatchRow = z.infer<typeof tankPatchRowSchema>;
export type PipePatchRow = z.infer<typeof pipePatchRowSchema>;
export type PumpPatchRow = z.infer<typeof pumpPatchRowSchema>;
export type ValvePatchRow = z.infer<typeof valvePatchRowSchema>;
export type CustomerPointPatchRow = z.infer<typeof customerPointPatchRowSchema>;

export type AssetPatchRow =
  | JunctionPatchRow
  | ReservoirPatchRow
  | TankPatchRow
  | PipePatchRow
  | PumpPatchRow
  | ValvePatchRow;

export type AssetPatchRows = {
  junctions: JunctionPatchRow[];
  reservoirs: ReservoirPatchRow[];
  tanks: TankPatchRow[];
  pipes: PipePatchRow[];
  pumps: PumpPatchRow[];
  valves: ValvePatchRow[];
};

export const emptyAssetPatchRows = (): AssetPatchRows => ({
  junctions: [],
  reservoirs: [],
  tanks: [],
  pipes: [],
  pumps: [],
  valves: [],
});
