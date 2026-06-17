import { z } from "zod";

const timedSettingStepSchema = z.object({
  time: z.number(),
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
