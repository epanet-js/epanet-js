import type { BuildZonesResult } from "@epanet-js/converters";
import type { CustomAttributeId } from "@epanet-js/hydraulic-model";

export type SummaryColumn = { id: CustomAttributeId; label: string };

export type SummaryRow = {
  label: string;
  values: (string | number | null)[];
  featureCount: number;
};

export const buildSummaryRows = (
  { zones, mergedZones, renamedZones }: BuildZonesResult,
  columns: SummaryColumn[],
): SummaryRow[] => {
  const featureCounts = new Map(
    mergedZones.map(({ label, featureCount }) => [label, featureCount]),
  );
  const originalLabels = new Map(
    renamedZones.map(({ label, originalLabel }) => [label, originalLabel]),
  );
  const renamedFrom = new Set(originalLabels.values());

  const groups = new Map<string, SummaryRow[]>();
  for (const zone of zones.values()) {
    const original = originalLabels.get(zone.label) ?? zone.label;
    const featureCount = featureCounts.get(zone.label) ?? 1;
    if (featureCount === 1 && !renamedFrom.has(original)) continue;

    const row: SummaryRow = {
      label: zone.label,
      values: columns.map(
        ({ id }) =>
          (zone.getProperty(id) as string | number | undefined) ?? null,
      ),
      featureCount,
    };
    const group = groups.get(original);
    if (group) group.push(row);
    else groups.set(original, [row]);
  }

  return [...groups.values()].flat();
};
