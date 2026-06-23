import { atom } from "jotai";
import type { CheckType } from "src/panels/network-review/common";
import type { ValidationIssue } from "src/lib/model-validation";

export const modelValidationIssuesAtom = atom<ValidationIssue[]>([]);

export const selectedReviewCheckAtom = atom<CheckType | null>(null);
