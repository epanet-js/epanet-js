import { atom } from "jotai";
import type { CheckType } from "src/panels/network-review/common";
import type { AssetId } from "@epanet-js/hydraulic-model";
import type { ValidationIssues } from "src/lib/model-attributes-validation";
import type { SubNetwork } from "src/lib/network-review/connectivity-trace";

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

export const selectedReviewCheckAtom = atom<CheckType | null>(null);
