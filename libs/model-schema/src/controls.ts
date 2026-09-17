import { z } from "zod";
import { pumpStatuses } from "./enums";

const timedSettingStepSchema = z.object({
  time: z.number(),
  status: z.enum(pumpStatuses),
  setting: z.number(),
});

const timedSettingControlSchema = z.object({
  id: z.string(),
  type: z.literal("timed-setting"),
  linkId: z.number(),
  steps: z.array(timedSettingStepSchema),
});

const levelSettingControlSchema = z.object({
  id: z.string(),
  type: z.literal("level-setting"),
  linkId: z.number(),
  tankId: z.number(),
  on: z.object({ level: z.number(), setting: z.number() }),
  off: z.object({ level: z.number() }),
});

export const controlSchema = z.discriminatedUnion("type", [
  timedSettingControlSchema,
  levelSettingControlSchema,
]);

export const controlsSchema = z.array(controlSchema);
