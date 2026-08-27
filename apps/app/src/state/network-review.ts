import { atom } from "jotai";
import type { CheckType, SubNetwork } from "src/lib/network-review";
import type { AssetId } from "@epanet-js/hydraulic-model";
import type { Unit } from "@epanet-js/quantity";
import type { ValidationIssues } from "src/lib/model-attributes-validation";

export type ReviewCheckEntry<T> = {
  modelVersion: string;
  issueCount: number;
  items: T;
};

export type ReviewResults = {
  [CheckType.modelAttributesValidation]?: ReviewCheckEntry<ValidationIssues>;
  [CheckType.orphanAssets]?: ReviewCheckEntry<AssetId[]>;
  [CheckType.connectivityTrace]?: ReviewCheckEntry<SubNetwork[]>;
};

export const reviewResultsAtom = atom<ReviewResults>({});

export const selectedReviewCheckAtom = atom<CheckType | "summary" | null>(null);

export type ArchivedItems = Partial<Record<CheckType, string[]>>;

export const archivedNetworkReviewItemsAtom = atom<ArchivedItems>({});

export type ProximityDistance = { value: number; unit: Unit };

export const proximityDistanceAtom = atom<ProximityDistance | null>(null);
