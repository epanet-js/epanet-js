import { Unit } from "src/quantity";
import { LngLat } from "mapbox-gl";
import { isFeatureOn } from "src/infra/feature-flags";
import {
  fallbackElevation,
  fetchElevationForPoint,
  fetchElevationForPointDeprecated,
  prefetchElevationsTile,
  prefetchElevationsTileDeprecated,
} from "./elevations";
import { captureError } from "src/infra/error-tracking";
import { notify } from "src/components/notifications";
import { LinkBreak1Icon } from "@radix-ui/react-icons";

export const useElevations = (unit: Unit) => {
  const prefetchTile = (lngLat: LngLat) => {
    isFeatureOn("FLAG_OFFLINE_ERROR")
      ? void prefetchElevationsTile(lngLat)
      : void prefetchElevationsTileDeprecated(lngLat).catch((e) =>
          captureError(e),
        );
  };

  const fetchElevation = async (lngLat: LngLat) => {
    let elevation;

    if (isFeatureOn("FLAG_OFFLINE_ERROR")) {
      try {
        elevation = await fetchElevationForPoint(lngLat, {
          unit,
        });
      } catch (error) {
        if ((error as Error).message.includes("Failed to fetch")) {
          notify({
            variant: "warning",
            Icon: LinkBreak1Icon,
            title: "Failed to Fetch Elevation",
            description:
              "Elevation data cannot be retrieved, so 0 will be assigned.",
            id: "elevations-failed-to-fetch",
          });
        }
        if ((error as Error).message.includes("Tile not found")) {
          notify({
            variant: "warning",
            Icon: LinkBreak1Icon,
            title: "Elevation Not Avaiable",
            description:
              "It wasn't possible to retrieve the elevation for this point. Using 0 instead.",
            id: "elevations-not-found",
          });
        }
        elevation = fallbackElevation;
      }
    } else {
      elevation = await fetchElevationForPointDeprecated(lngLat, {
        unit,
      });
    }
    return elevation;
  };

  return { fetchElevation, prefetchTile };
};
