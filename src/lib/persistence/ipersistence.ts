import type { ISymbology } from "src/types";
import { Promisable } from "type-fest";
import { z } from "zod";
import { HydraulicModel, ModelMoment } from "src/hydraulic-model";
import { ModelFactories } from "src/hydraulic-model/factories";
import { ProjectSettings } from "src/lib/project-settings";
import type { Projection } from "src/lib/projections/projection";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import type { SimulationState } from "src/state/simulation";

export type PersistenceMetadataMemory = {
  type: "memory";
  symbology: ISymbology;
  label: string | null;
  layer: any;
};

export type PersistenceMetadata = PersistenceMetadataMemory;

export interface TransactOptions {
  quiet?: boolean;
}

export const EditWrappedFeatureCollection = z.object({
  id: z.string(),
  name: z.optional(z.string()),
  label: z.optional(z.string()),
  layerId: z.optional(z.number().int().nullable()),
  defaultLayer: z.any(),
  access: z.any(),
  symbology: z.any(),
  wrappedFeatureCollectionFolderId: z.string().uuid().nullable().optional(),
});

export type MetaUpdatesInput = Omit<
  z.infer<typeof EditWrappedFeatureCollection>,
  "id"
>;

export type MetaPair = [
  PersistenceMetadata,
  (updates: MetaUpdatesInput) => Promisable<void>,
];

export interface IPersistence {
  useHistoryControlDeprecated(): (direction: "undo" | "redo") => void;

  useTransactDeprecated(): (moment: ModelMoment) => void;
  useTransactImportDeprecated(): (
    hydraulicModel: HydraulicModel,
    factories: ModelFactories,
    projectSettings: ProjectSettings,
    name: string,
    simulationSettings: SimulationSettings,
    options?: { autoElevations?: boolean },
  ) => void;

  useTransactReprojection(): (
    newProjection: Projection,
    currentProjection: Projection,
  ) => Promise<void>;
}

export interface IPersistenceWithSnapshots extends IPersistence {
  syncSnapshotSimulation(simulation: SimulationState): void;
  deleteSnapshotFromCache(snapshotId: string): void;
}
