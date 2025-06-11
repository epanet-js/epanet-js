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
import { ValueNoneIcon } from "@radix-ui/react-icons";
import { translate } from "src/infra/i18n";

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
            Icon: ValueNoneIcon,
            title: translate("failedToFetchElevation"),
            description: translate("failedToFetchElevationExplain"),
            id: "elevations-failed-to-fetch",
          });
        }
        if ((error as Error).message.includes("Tile not found")) {
          notify({
            variant: "warning",
            Icon: ValueNoneIcon,
            title: translate("elevationNotAvailable"),
            description: translate("elevationNotAvailableExplain"),
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
