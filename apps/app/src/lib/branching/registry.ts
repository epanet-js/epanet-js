import {
  nullBranchingRules,
  nullBranchStore,
  type BranchingRules,
  type BranchStore,
} from "@epanet-js/worktree";

let rules: BranchingRules = nullBranchingRules;
let store: BranchStore = nullBranchStore;

export const registerBranchingRules = (
  implementation: BranchingRules,
): void => {
  rules = implementation;
};

export const getBranchingRules = (): BranchingRules => rules;

export const registerBranchStore = (implementation: BranchStore): void => {
  store = implementation;
};

export const getBranchStore = (): BranchStore => store;
