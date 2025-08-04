import { CustomerPoints } from "../../customer-points";

export type AllocationRule = {
  maxDistance: number;
  maxDiameter: number;
};

export type AllocationResult = {
  allocatedCustomerPoints: CustomerPoints;
  ruleMatches: number[];
};
