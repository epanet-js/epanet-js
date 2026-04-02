import { useContext } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import type { FeatureCollection } from "geojson";
import type { LngLatBoundsLike } from "mapbox-gl";
import { projectSettingsAtom } from "src/state/project-settings";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { dialogAtom } from "src/state/dialog";
import { Button } from "src/components/elements";
import { CollapsibleSection } from "src/components/form/fields";
import { mapStylingPanelSectionsExpandedAtom } from "src/state/layout";
import { MapPinnedIcon } from "src/icons";
import type { Projection } from "src/lib/projections/projection";
import { inverseProjectGeoJson } from "src/lib/projections";
import { chooseUnitSystem } from "src/simulation/build-inp";
import { usePersistence } from "src/lib/persistence";
import { MapContext } from "src/map";
import { captureError } from "src/infra/error-tracking";
import { hasScenariosAtom } from "src/state/scenarios";
import { useTranslate } from "src/hooks/use-translate";

export const ProjectionSection = () => {
  const projectSettings = useAtomValue(projectSettingsAtom);
  const { projection } = projectSettings;
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const map = useContext(MapContext);
  const rep = usePersistence();
  const transactReprojection = rep.useTransactReprojection();
  const hasScenarios = useAtomValue(hasScenariosAtom);
  const isXYGrid = projection.type === "xy-grid";
  const t = useTranslate();

  const handleOpenProjectionDialog = () => {
    const geoJson: FeatureCollection = {
      type: "FeatureCollection",
      features: [...hydraulicModel.assets.values()].map((a) => a.feature),
    };

    const previewGeoJson = inverseProjectGeoJson(geoJson, projection);

    setDialogState({
      type: "networkProjection",
      source: "map-panel",
      previewGeoJson,
      onImportWithProjection: async (newProjection: Projection, extent) => {
        setDialogState({ type: "loading" });
        try {
          await transactReprojection(newProjection, projection);
          if (extent) {
            map?.map.once("idle", () => {
              map.map.fitBounds(extent as LngLatBoundsLike, {
                padding: 100,
                duration: 0,
              });
            });
          }
          setDialogState(null);
        } catch (error) {
          captureError(error as Error);
          setDialogState(null);
        }
      },
      filename: "",
      flowUnits: chooseUnitSystem(projectSettings.units),
      initialProjection:
        projection.type === "proj4"
          ? projection
          : projection.type === "wgs84"
            ? {
                type: "proj4",
                id: "EPSG:4326",
                name: "WGS 84",
                code: "EPSG:4326",
              }
            : undefined,
    });
  };

  const projectionName =
    projection.type === "wgs84" ? "WGS 84" : projection.name;
  const projectionCode =
    projection.type === "wgs84" ? "EPSG:4326" : projection.id;

  const [sections, setSections] = useAtom(mapStylingPanelSectionsExpandedAtom);

  return (
    <CollapsibleSection
      title="Projection"
      open={sections.projection}
      onOpenChange={(open) =>
        setSections((prev) => ({ ...prev, projection: open }))
      }
      separator={false}
      variant="primary"
    >
      {isXYGrid ? (
        <Button
          variant="default"
          size="sm"
          className="w-full justify-center"
          disabled={hasScenarios}
          onClick={handleOpenProjectionDialog}
        >
          <MapPinnedIcon />
          {t("networkProjection.setMapProjection")}
        </Button>
      ) : (
        <div className="flex items-start gap-2 -mr-1">
          <div className="flex flex-col min-w-0 flex-1 text-sm">
            <div className="truncate">{projectionName}</div>
            <div className="text-gray-500 truncate">{projectionCode}</div>
          </div>
          {(projection.type === "proj4" || projection.type === "wgs84") &&
            !hasScenarios && (
              <Button
                variant="quiet/mode"
                className="h-8 flex-shrink-0"
                onClick={handleOpenProjectionDialog}
                aria-label="Change projection"
              >
                <MapPinnedIcon />
              </Button>
            )}
        </div>
      )}
    </CollapsibleSection>
  );
};
