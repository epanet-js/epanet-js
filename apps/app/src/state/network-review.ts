import { atom } from "jotai";
import type { CheckType } from "src/panels/network-review/common";
import type { ValidationIssue } from "src/lib/model-attributes-validation";

export const modelAttributesValidationIssuesAtom = atom<ValidationIssue[]>([]);

export const selectedReviewCheckAtom = atom<CheckType | null>(null);
