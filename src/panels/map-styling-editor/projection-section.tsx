import { useContext } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import type { FeatureCollection } from "geojson";
import type { LngLatBoundsLike } from "mapbox-gl";
import { projectSettingsAtom } from "src/state/project-settings";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { dialogAtom } from "src/state/dialog";
import { Button } from "src/components/elements";
import { Section } from "src/components/form/fields";
import { PencilIcon } from "src/icons";
import type { Projection } from "src/lib/projections/projection";
import { inverseProjectGeoJson } from "src/lib/projections";
import { chooseUnitSystem } from "src/simulation/build-inp";
import { usePersistence } from "src/lib/persistence";
import { MapContext } from "src/map";
import { captureError } from "src/infra/error-tracking";
import { hasScenariosAtom } from "src/state/scenarios";
import { useUnsavedChangesCheck } from "src/commands/check-unsaved-changes";

export const ProjectionSection = () => {
  const projectSettings = useAtomValue(projectSettingsAtom);
  const { projection } = projectSettings;
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const map = useContext(MapContext);
  const rep = usePersistence();
  const transactReprojection = rep.useTransactReprojection();
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const hasScenarios = useAtomValue(hasScenariosAtom);
  const isXYGrid = projection.type === "xy-grid";

  const handleOpenProjectionDialog = () => {
    const geoJson: FeatureCollection = {
      type: "FeatureCollection",
      features: [...hydraulicModel.assets.values()].map((a) => a.feature),
    };

    const previewGeoJson = inverseProjectGeoJson(geoJson, projection);

    setDialogState({
      type: "networkProjection",
      previewGeoJson,
      onImportWithProjection: async (newProjection: Projection, extent) => {
        setDialogState({ type: "loading" });
        try {
          await transactReprojection(newProjection, projection);
          if (extent) {
            map?.map.fitBounds(extent as LngLatBoundsLike, {
              padding: 100,
              duration: 0,
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
      initialProjection: projection.type === "proj4" ? projection : undefined,
    });
  };

  const projectionName =
    projection.type === "wgs84" ? "WGS 84" : projection.name;
  const projectionCode =
    projection.type === "wgs84" ? "EPSG:4326" : projection.id;

  return (
    <Section title="Projection">
      {isXYGrid ? (
        <Button
          variant="default"
          size="sm"
          className="w-full justify-center"
          disabled={hasScenarios}
          onClick={() => checkUnsavedChanges(handleOpenProjectionDialog)}
        >
          Project network
        </Button>
      ) : (
        <div className="flex items-start gap-2">
          <div className="flex flex-col min-w-0 flex-1 text-sm">
            <div className="truncate">{projectionName}</div>
            <div className="text-gray-500 truncate">{projectionCode}</div>
          </div>
          {projection.type === "proj4" && (
            <button
              className="opacity-30 hover:opacity-100 select-none flex-shrink-0"
              disabled={hasScenarios}
              onClick={() => checkUnsavedChanges(handleOpenProjectionDialog)}
              aria-label="Change projection"
            >
              <PencilIcon />
            </button>
          )}
        </div>
      )}
    </Section>
  );
};
