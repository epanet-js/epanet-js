import { useCallback, useRef } from "react";
import { useSetAtom } from "jotai";
import { elevationSourcesAtom } from "src/state/elevation-sources";
import { computeTileBoundaries } from "src/lib/elevations/compute-boundary";
import type { GeoTiffTile } from "src/lib/elevations";
import { Geometry } from "geojson";

export function useComputeTileBoundaries() {
  const setSources = useSetAtom(elevationSourcesAtom);
  const cancelledTilesRef = useRef(new Set<string>());

  const computeForTiles = useCallback(
    (sourceId: string, tiles: GeoTiffTile[]) => {
      const onTileComputed = ({
        tileId,
        polygon,
      }: {
        tileId: string;
        polygon: Geometry | null;
      }) => {
        if (!polygon) return;
        setSources((prev) =>
          prev.map((s) =>
            s.id === sourceId && s.type === "geotiff"
              ? {
                  ...s,
                  tiles: s.tiles.map((t) =>
                    t.id === tileId ? { ...t, coveragePolygon: polygon } : t,
                  ),
                }
              : s,
          ),
        );
      };

      const isTileCancelled = (tileId: string) =>
        cancelledTilesRef.current.has(tileId);

      void computeTileBoundaries(tiles, onTileComputed, isTileCancelled);
    },
    [setSources],
  );

  const cancelTiles = useCallback((tileIds: string[]) => {
    for (const id of tileIds) cancelledTilesRef.current.add(id);
  }, []);

  return { computeForTiles, cancelTiles };
}
