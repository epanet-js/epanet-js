import { useEffect, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { profileViewAtom } from "src/state/profile-view";
import {
  stagingModelDerivedAtom,
  simulationDerivedAtom,
} from "src/state/derived-branch-state";
import { AssetId } from "src/hydraulic-model";
import { captureError } from "src/infra/error-tracking";
import type { EPSResultsReader } from "src/simulation";

export type HglRange = {
  nodeId: AssetId;
  minHead: number;
  maxHead: number;
};

type NodeRef = { nodeId: AssetId; type: "junction" | "tank" | "reservoir" };

export function useProfileHglRange(): {
  ranges: (HglRange | null)[] | null;
  isLoading: boolean;
} {
  const profileView = useAtomValue(profileViewAtom);
  const model = useAtomValue(stagingModelDerivedAtom);
  const simulation = useAtomValue(simulationDerivedAtom);

  const [ranges, setRanges] = useState<(HglRange | null)[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const epsResultsReader: EPSResultsReader | null =
    "epsResultsReader" in simulation && simulation.epsResultsReader
      ? simulation.epsResultsReader
      : null;

  const pathNodeIds =
    profileView.phase === "showingProfile" ? profileView.path.nodeIds : null;
  const pathKey = pathNodeIds ? pathNodeIds.join(",") : "";

  useEffect(() => {
    if (!pathNodeIds || !epsResultsReader) {
      setRanges(null);
      setIsLoading(false);
      return;
    }

    const nodeRefs: (NodeRef | null)[] = pathNodeIds.map((nodeId) => {
      const asset = model.assets.get(nodeId);
      if (!asset || asset.isLink) return null;
      const type = asset.type;
      if (type !== "junction" && type !== "tank" && type !== "reservoir") {
        return null;
      }
      return { nodeId, type };
    });

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);

    const fetchAll = async () => {
      try {
        const results = await Promise.all(
          nodeRefs.map(async (ref) => {
            if (!ref) return null;
            try {
              let series;
              if (ref.type === "junction") {
                series = await epsResultsReader.getTimeSeries(
                  ref.nodeId,
                  "junction",
                  "head",
                );
              } else if (ref.type === "tank") {
                series = await epsResultsReader.getTimeSeries(
                  ref.nodeId,
                  "tank",
                  "head",
                );
              } else {
                series = await epsResultsReader.getTimeSeries(
                  ref.nodeId,
                  "reservoir",
                  "head",
                );
              }
              if (!series || series.values.length === 0) return null;
              let min = series.values[0];
              let max = series.values[0];
              for (let i = 1; i < series.values.length; i++) {
                const v = series.values[i];
                if (v < min) min = v;
                if (v > max) max = v;
              }
              return { nodeId: ref.nodeId, minHead: min, maxHead: max };
            } catch (err) {
              captureError(err as Error);
              return null;
            }
          }),
        );

        if (controller.signal.aborted) return;
        setRanges(results);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void fetchAll();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathKey, epsResultsReader, model.assets]);

  return { ranges, isLoading };
}
