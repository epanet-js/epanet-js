import type { ZoneFeature } from "src/commands/read-zone-features";
import { Zone } from "src/hydraulic-model/zones";
import { ZoneFactory } from "src/hydraulic-model/factories/zone-factory";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { ConsecutiveIdsGenerator } from "src/lib/id-generator";

export const buildZonesFromFeatures = (
  features: ZoneFeature[],
  labelProperty: string | undefined,
): Zone[] => {
  const labelManager = new LabelManager();
  const factory = new ZoneFactory(new ConsecutiveIdsGenerator(), labelManager);

  return features.map((feature) => {
    const label = labelProperty
      ? String(feature.properties?.[labelProperty] ?? "")
      : undefined;
    return factory.create(feature.geometry, label ? { label } : undefined);
  });
};
