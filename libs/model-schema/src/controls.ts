import { z } from "zod";
import { pumpStatuses, variableSpeedPumpQuantities } from "./enums";

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

const variableSpeedPumpSchedulePointSchema = z.object({
  time: z.number(),
  target: z.number(),
});

const variableSpeedPumpControlSchema = z.object({
  id: z.string(),
  type: z.literal("variable-speed-pump"),
  linkId: z.number(),
  quantity: z.enum(variableSpeedPumpQuantities),
  targetId: z.number(),
  target: z.number(),
  minSpeed: z.number(),
  maxSpeed: z.number(),
  laggedPumpIds: z.array(z.number()),
  schedule: z.array(variableSpeedPumpSchedulePointSchema),
  tankLevels: z
    .object({
      tankId: z.number(),
      offLevel: z.number(),
      onLevel: z.number(),
    })
    .optional(),
});

export const controlSchema = z.discriminatedUnion("type", [
  timedSettingControlSchema,
  levelSettingControlSchema,
  variableSpeedPumpControlSchema,
]);

export const controlsSchema = z.array(controlSchema);
