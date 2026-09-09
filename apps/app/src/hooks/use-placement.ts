import { useMemo } from "react";
import { useAtomValue } from "jotai";
import type { Position } from "geojson";
import type { Issue } from "@epanet-js/converters";
import { createProjectionMapper } from "@epanet-js/projections";
import { projectSettingsAtom } from "src/state/project-settings";

export type Placement =
  | { kind: "wgs84" }
  | { kind: "transform"; toWgs84: (coordinates: Position) => Position };

export const useProjectPlacement = (): Placement => {
  const { projection } = useAtomValue(projectSettingsAtom);

  return useMemo(
    () =>
      projection.type === "xy-grid"
        ? {
            kind: "transform",
            toWgs84: createProjectionMapper(projection).toWgs84,
          }
        : { kind: "wgs84" },
    [projection],
  );
};

export const placementFor = (
  projectPlacement: Placement,
  sourceIssues: Issue[],
): Placement =>
  sourceIssues.some(({ severity }) => severity === "error")
    ? projectPlacement
    : { kind: "wgs84" };
