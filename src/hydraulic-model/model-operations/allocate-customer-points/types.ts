import { CustomerPoints } from "../../customer-points";

export type AllocationRule = {
  maxDistance: number;
  maxDiameter: number;
};

export type AllocationResult = {
  allocatedCustomerPoints: CustomerPoints;
  disconnectedCustomerPoints: CustomerPoints;
  ruleMatches: number[];
};
