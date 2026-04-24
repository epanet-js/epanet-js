import { useEffect, useState } from "react";
import { fetchElevationForPoint } from "src/lib/elevations";
import type { ProfilePoint } from "./use-profile-data";

export function useTerrainElevations(
  points: ProfilePoint[] | null,
): number[] | null {
  const [terrainElevations, setTerrainElevations] = useState<number[] | null>(
    null,
  );

  const coordinateKey = points
    ? points.map((p) => p.coordinates.join(",")).join("|")
    : null;

  useEffect(() => {
    if (!points || points.length === 0) {
      setTerrainElevations(null);
      return;
    }

    setTerrainElevations(null);

    let cancelled = false;

    void Promise.all(
      points.map((p) =>
        fetchElevationForPoint(
          { lng: p.coordinates[0], lat: p.coordinates[1] },
          { unit: "m" },
        ).catch(() => null),
      ),
    ).then((results) => {
      if (!cancelled) {
        const elevations = results.map((v) => v ?? 0);
        setTerrainElevations(elevations);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinateKey]);

  return terrainElevations;
}
