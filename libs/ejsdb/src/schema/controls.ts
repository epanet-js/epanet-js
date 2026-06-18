import { z } from "zod";
import { pumpStatuses } from "./enums";

const timedSettingStepSchema = z.object({
  time: z.number(),
  status: z.enum(pumpStatuses),
  setting: z.number(),
});

const timedSettingControlSchema = z.object({
  type: z.literal("timed-setting"),
  linkId: z.number(),
  steps: z.array(timedSettingStepSchema),
});

export const controlSchema = z.discriminatedUnion("type", [
  timedSettingControlSchema,
]);

export const controlsSchema = z.array(controlSchema);
