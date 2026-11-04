import {
  LabelManager,
  type LabelType,
  type ModelFactories,
} from "@epanet-js/hydraulic-model";
import type { ChangeSet, EntityKind } from "@epanet-js/change-set";
import type { IdPool } from "@epanet-js/id-generator";

type Identifiers = { pool: IdPool; labelType: LabelType | null };

const identifiersByEntity: Record<EntityKind, Identifiers | null> = {
  junction: { pool: "asset", labelType: "junction" },
  reservoir: { pool: "asset", labelType: "reservoir" },
  tank: { pool: "asset", labelType: "tank" },
  pipe: { pool: "asset", labelType: "pipe" },
  pump: { pool: "asset", labelType: "pump" },
  valve: { pool: "asset", labelType: "valve" },
  customerPoint: { pool: "customerPoint", labelType: "customerPoint" },
  pattern: { pool: "pattern", labelType: "pattern" },
  curve: { pool: "curve", labelType: "curve" },
  junctionDemand: null,
  customerDemand: null,
  allControls: null,
  customAttributesDefinition: null,
  pipeLibrary: null,
  rawControls: null,
  zone: { pool: "zone", labelType: "zone" },
};

export const observeIdentifiers = (
  factories: ModelFactories,
  changeSet: ChangeSet,
): void => {
  const counters = factories.labelCounters;

  for (const entry of changeSet.entries()) {
    const identifiers = identifiersByEntity[entry.entity];
    if (!identifiers) continue;
    const { pool, labelType } = identifiers;

    if (typeof entry.id === "number") {
      factories.idPools.forPool(pool).observe(entry.id);
    }

    if (!labelType) continue;
    const label = entry.get("after", "label");
    if (typeof label !== "string") continue;
    const index = LabelManager.generatedIndex(label, labelType);
    if (index !== null && index + 1 > (counters.get(labelType) ?? 0)) {
      counters.set(labelType, index + 1);
    }
  }
};
