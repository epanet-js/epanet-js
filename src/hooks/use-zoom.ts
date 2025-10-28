import { useCallback, useContext } from "react";
import { MapContext } from "src/map";

export function useZoom() {
  const map = useContext(MapContext);

  const zoomIn = useCallback(() => {
    map?.map.zoomIn();
  }, [map]);

  const zoomOut = useCallback(() => {
    map?.map.zoomOut();
  }, [map]);

  return { zoomIn, zoomOut };
}
