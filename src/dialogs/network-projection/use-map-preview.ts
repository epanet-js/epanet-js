import { useRef, useMemo } from "react";
import type { FeatureCollection } from "geojson";
import type { Bbox } from "./types";

export type MapPreviewHandle = {
  fitToNetwork: (geoJSON: FeatureCollection) => void;
  fitToBbox: (bbox: Bbox) => void;
};

export const useMapPreview = () => {
  const handleRef = useRef<MapPreviewHandle | null>(null);

  const actions = useMemo(
    () => ({
      fitToNetwork: (geoJSON: FeatureCollection) =>
        handleRef.current?.fitToNetwork(geoJSON),
      fitToBbox: (bbox: Bbox) => handleRef.current?.fitToBbox(bbox),
    }),
    [],
  );

  const setHandle = useMemo(
    () => (handle: MapPreviewHandle | null) => {
      handleRef.current = handle;
    },
    [],
  );

  return { ...actions, setHandle };
};
