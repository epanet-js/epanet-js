import type { ISymbology } from "src/types";
import { Promisable } from "type-fest";
import { z } from "zod";
import { HydraulicModel, ModelMoment } from "src/hydraulic-model";
import { ModelMetadata } from "src/model-metadata";
import type { SimulationState } from "src/state/jotai";
import type { MomentLog } from "src/lib/persistence/moment-log";
import type { Worktree } from "src/lib/worktree/types";

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
  useHistoryControl(): (
    direction: "undo" | "redo",
    options?: { restoreSimulation?: boolean },
  ) => Promise<void>;

  useTransact(): (moment: ModelMoment) => void;
  useTransactImport(): (
    hydraulicModel: HydraulicModel,
    modelMetadata: ModelMetadata,
    name: string,
  ) => void;
}

export interface IPersistenceWithSnapshots extends IPersistence {
  getMomentLog(): MomentLog;
  getSimulation(): SimulationState;
  getModelVersion(): string;
  applySnapshot(worktree: Worktree, snapshotId: string): void;
  syncSnapshotSimulation(simulation: SimulationState): void;
  deleteSnapshotFromCache(snapshotId: string): void;
}
