import { point } from "@turf/helpers";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { Position } from "geojson";

import type {
  CustomerPointConnection,
  CustomerPointAllocationRule,
} from "@epanet-js/hydraulic-model";
import { AllocationResultsBuilder } from "./allocation-results";
import { RunData, RunDataView } from "./run-data";
import { findNearestPipeConnection } from "./nearest-pipe-connection";

export const runAllocation = (
  workerData: RunData,
  allocationRules: CustomerPointAllocationRule[],
  offset: number = 0,
  count?: number,
): ArrayBuffer => {
  const data = new RunDataView(workerData);
  const { spatialIndex, customerPoints, zoneGeometry } = data;
  const totalCustomerPointsCount = customerPoints.count;

  const actualCount = count ?? totalCustomerPointsCount - offset;
  const endIndex = Math.min(offset + actualCount, totalCustomerPointsCount);
  const resultCount = Math.max(0, endIndex - offset);

  const results = new AllocationResultsBuilder(resultCount);

  if (spatialIndex.numItems === 0) {
    for (let i = offset; i < endIndex; i++) {
      results.set(i - offset, {
        customerPointId: customerPoints.getId(i),
        connection: null,
        ruleIndex: -1,
        inZone: !zoneGeometry,
      });
    }
    return results.build();
  }

  for (let i = offset; i < endIndex; i++) {
    const customerPointId = customerPoints.getId(i);
    const customerPointCoordinates = customerPoints.getCoordinates(i);

    if (zoneGeometry) {
      if (!booleanPointInPolygon(customerPointCoordinates, zoneGeometry)) {
        results.set(i - offset, {
          customerPointId,
          connection: null,
          ruleIndex: -1,
          inZone: false,
        });
        continue;
      }
    }

    const { ruleIndex, connection } = findFirstMatchingRule(
      customerPointCoordinates,
      allocationRules,
      data,
    );

    results.set(i - offset, {
      customerPointId,
      connection,
      ruleIndex,
      inZone: true,
    });
  }

  return results.build();
};

const findFirstMatchingRule = (
  customerPointCoordinates: Position,
  allocationRules: CustomerPointAllocationRule[],
  data: RunDataView,
): { ruleIndex: number; connection: CustomerPointConnection | null } => {
  const customerPointFeature = point(customerPointCoordinates);

  for (let i = 0; i < allocationRules.length; i++) {
    const rule = allocationRules[i];

    const connection = findNearestPipeConnection(
      customerPointFeature,
      rule.maxDistance,
      rule.maxDiameter,
      data,
    );

    if (connection) {
      return { ruleIndex: i, connection };
    }
  }

  return { ruleIndex: -1, connection: null };
};
