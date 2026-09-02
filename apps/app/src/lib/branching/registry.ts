import { nullBranchingRules, type BranchingRules } from "@epanet-js/worktree";

let rules: BranchingRules = nullBranchingRules;

export const registerBranchingRules = (
  implementation: BranchingRules,
): void => {
  rules = implementation;
};

export const getBranchingRules = (): BranchingRules => rules;
