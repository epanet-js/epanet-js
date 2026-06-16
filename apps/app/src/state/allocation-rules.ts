import { atom } from "jotai";
import type { CustomerPointAllocationRule } from "@epanet-js/hydraulic-model";

export const allocationRulesAtom = atom<CustomerPointAllocationRule[] | null>(
  null,
);
