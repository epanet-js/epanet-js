import { atom } from "jotai";
import type { CheckType } from "src/panels/network-review/common";
import type { ValidationIssue } from "src/lib/model-attributes-validation";
import type { OrphanAsset } from "src/lib/network-review/orphan-assets";
import type { SubNetwork } from "src/lib/network-review/connectivity-trace";

export type ReviewCheckEntry<T> = {
  modelVersion: string;
  issueCount: number;
  items: T;
};

export type ReviewResults = {
  [CheckType.modelAttributesValidation]?: ReviewCheckEntry<ValidationIssue[]>;
  [CheckType.orphanAssets]?: ReviewCheckEntry<OrphanAsset[]>;
  [CheckType.connectivityTrace]?: ReviewCheckEntry<SubNetwork[]>;
};

export const reviewResultsAtom = atom<ReviewResults>({});

export const selectedReviewCheckAtom = atom<CheckType | null>(null);
