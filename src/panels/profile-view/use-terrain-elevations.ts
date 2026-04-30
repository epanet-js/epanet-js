import { useEffect, useState } from "react";
import { fetchElevationForPoint } from "src/lib/elevations";
import type { TerrainSample } from "./terrain-samples";

export type TerrainPoint = {
  cumulativeLength: number;
  elevation: number;
};

export function useTerrainElevations(
  samples: TerrainSample[] | null,
): TerrainPoint[] | null {
  const [terrainPoints, setTerrainPoints] = useState<TerrainPoint[] | null>(
    null,
  );

  const sampleKey = samples
    ? samples
        .map((s) => `${s.cumulativeLength}:${s.coordinates.join(",")}`)
        .join("|")
    : null;

  useEffect(() => {
    if (!samples || samples.length === 0) {
      setTerrainPoints(null);
      return;
    }

    setTerrainPoints(null);

    let cancelled = false;

    void Promise.all(
      samples.map((s) =>
        fetchElevationForPoint(
          { lng: s.coordinates[0], lat: s.coordinates[1] },
          { unit: "m" },
        ).catch(() => null),
      ),
    ).then((results) => {
      if (!cancelled) {
        setTerrainPoints(
          results.map((elevation, i) => ({
            cumulativeLength: samples[i].cumulativeLength,
            elevation: elevation ?? 0,
          })),
        );
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleKey]);

  return terrainPoints;
}
