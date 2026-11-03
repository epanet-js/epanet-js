import { FlowModulatingValvePoint } from "@epanet-js/hydraulic-model";

export const FLOW_MODULATING_VALVE_MIN_POINTS = 2;

type Points = FlowModulatingValvePoint[];
type Column = keyof FlowModulatingValvePoint;

const isStrictlyIncreasing = (points: Points, column: Column): boolean =>
  points.every(
    (point, index) => index === 0 || point[column] > points[index - 1][column],
  );

export const flowModulatingValvePointChecks = {
  flowsNonNegative: (points: Points): boolean =>
    points.every((point) => point.flow >= 0),
  pressuresPositive: (points: Points): boolean =>
    points.every((point) => point.pressure > 0),
  flowsIncreasing: (points: Points): boolean =>
    isStrictlyIncreasing(points, "flow"),
  pressuresIncreasing: (points: Points): boolean =>
    isStrictlyIncreasing(points, "pressure"),
};

export type FlowModulatingValvePointErrors = {
  flow: Set<number>;
  pressure: Set<number>;
};

const isInSequence = (
  points: Points,
  index: number,
  column: Column,
): boolean => {
  const value = points[index][column];
  const previous = index > 0 ? points[index - 1][column] : -Infinity;
  const next = index < points.length - 1 ? points[index + 1][column] : Infinity;
  return value > previous && value < next;
};

export const getFlowModulatingValvePointErrors = (
  points: Points,
): FlowModulatingValvePointErrors => {
  const flow = new Set<number>();
  const pressure = new Set<number>();
  points.forEach((point, index) => {
    if (point.flow < 0 || !isInSequence(points, index, "flow")) flow.add(index);
    if (point.pressure <= 0 || !isInSequence(points, index, "pressure"))
      pressure.add(index);
  });
  return { flow, pressure };
};
