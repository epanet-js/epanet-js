import { atom } from "jotai";
import type { BranchState } from "src/lib/worktree/types";

export const branchStateAtom = atom(new Map<string, BranchState>());
