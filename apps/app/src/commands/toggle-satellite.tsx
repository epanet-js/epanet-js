import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import {
  basemapAtom,
  customBasemapAtom,
  selectBasemapAtom,
} from "src/state/map";

export const toggleSatelliteShorcut = "b";

export const useToggleSatellite = () => {
  const basemap = useAtomValue(basemapAtom);
  const customBasemap = useAtomValue(customBasemapAtom);
  const selectBasemap = useSetAtom(selectBasemapAtom);

  const toggleSatellite = useCallback(() => {
    const isMonochrome = !customBasemap && basemap.style === "monochrome";
    selectBasemap(isMonochrome ? "satellite" : "monochrome");
  }, [basemap, customBasemap, selectBasemap]);

  return toggleSatellite;
};
