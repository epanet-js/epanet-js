import { CustomerPoints } from "@epanet-js/hydraulic-model";

export type AllocationRule = {
  maxDistance: number;
  maxDiameter: number;
};

export type AllocationResult = {
  allocatedCustomerPoints: CustomerPoints;
  disconnectedCustomerPoints: CustomerPoints;
  ruleMatches: number[];
};
