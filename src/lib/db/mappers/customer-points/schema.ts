import { z } from "zod";

const id = z.number().int();
const fkId = z.number().int().nullable();
const finiteCoord = z.number().finite();
const finiteCoordNullable = z.number().finite().nullable();

export const customerPointRowSchema = z.object({
  id,
  label: z.string(),
  coord_x: finiteCoord,
  coord_y: finiteCoord,
  pipe_id: fkId,
  junction_id: fkId,
  snap_x: finiteCoordNullable,
  snap_y: finiteCoordNullable,
});

export const customerPointDemandRowSchema = z.object({
  customer_point_id: id,
  ordinal: z.number().int(),
  base_demand: z.number().finite(),
  pattern_id: fkId,
});

export type CustomerPointRow = z.infer<typeof customerPointRowSchema>;
export type CustomerPointDemandRow = z.infer<
  typeof customerPointDemandRowSchema
>;

export type CustomerPointsData = {
  customerPoints: CustomerPointRow[];
  demands: CustomerPointDemandRow[];
};
