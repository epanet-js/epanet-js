import { z } from "zod";
import { mapThemeBasemapStyles, mapThemeRangeModes } from "./enums";

export const MAP_THEME_SPEC_VERSION = 1;

const finite = z.number().finite();

export const mapThemeSpecSchema = z
  .object({
    nodeColor: z.string(),
    nodeLabel: z.string().nullable(),
    nodeSizeMinVisibleZoom: finite,
    nodeSizeMin: finite,
    nodeSizeMax: finite,
    nodeColorBy: z.string().nullable(),
    nodeColorMode: z.enum(mapThemeRangeModes).nullable(),
    nodeColorRamp: z.string().nullable(),
    nodeColorRampReversed: z.boolean().nullable(),
    nodeColors: z.array(z.string()).nullable(),
    nodeBreaks: z.array(finite).nullable(),

    linkColor: z.string(),
    linkLabel: z.string().nullable(),
    linkColorBy: z.string().nullable(),
    linkColorMode: z.enum(mapThemeRangeModes).nullable(),
    linkColorRamp: z.string().nullable(),
    linkColorRampReversed: z.boolean().nullable(),
    linkColors: z.array(z.string()).nullable(),
    linkBreaks: z.array(finite).nullable(),

    zonesVisible: z.boolean(),
    zonesColor: z.string(),
    zonesLabel: z.string().nullable(),
    zonesColorBy: z.string().nullable(),
    zonesPalette: z.string(),

    customerPointsVisible: z.boolean(),

    basemapStyle: z.enum(mapThemeBasemapStyles),
    basemapVisible: z.boolean(),
    basemapLabels: z.boolean(),
    basemapOpacity: finite.min(0).max(1),
  })
  .superRefine((spec, ctx) => {
    for (const prefix of ["node", "link"] as const) {
      const colorBy = spec[`${prefix}ColorBy`];
      const fields = [
        spec[`${prefix}ColorMode`],
        spec[`${prefix}ColorRamp`],
        spec[`${prefix}ColorRampReversed`],
        spec[`${prefix}Colors`],
        spec[`${prefix}Breaks`],
      ];
      if (colorBy === null) {
        if (fields.some((field) => field !== null))
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${prefix} color fields must be null without ${prefix}ColorBy`,
          });
        continue;
      }
      if (fields.some((field) => field === null)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${prefix} color fields are required with ${prefix}ColorBy`,
        });
        continue;
      }
      const colors = spec[`${prefix}Colors`]!;
      const breaks = spec[`${prefix}Breaks`]!;
      if (colors.length === 0 || breaks.length !== colors.length - 1)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${prefix}Breaks must have one fewer entry than ${prefix}Colors`,
        });
    }
  });

export type MapThemeSpec = z.infer<typeof mapThemeSpecSchema>;

export const mapThemeRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  spec_version: z.literal(MAP_THEME_SPEC_VERSION),
  spec: mapThemeSpecSchema,
});

export type MapThemeRecord = z.infer<typeof mapThemeRecordSchema>;
