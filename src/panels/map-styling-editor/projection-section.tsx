import { useAtomValue, useSetAtom } from "jotai";
import type { FeatureCollection } from "geojson";
import { projectSettingsAtom } from "src/state/project-settings";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { dialogAtom } from "src/state/dialog";
import { Button } from "src/components/elements";
import { Section, InlineField } from "src/components/form/fields";
import { WarningIcon } from "src/icons";
import type { Projection } from "src/lib/projections/projection";
import { inverseProjectGeoJson } from "src/lib/projections";
import { chooseUnitSystem } from "src/simulation/build-inp";

const projectionTypeLabel = (projection: Projection) => {
  switch (projection.type) {
    case "wgs84":
      return "Global (GPS)";
    case "xy-grid":
      return "Local / No map";
    case "proj4":
      return "Regional / Survey";
  }
};

export const ProjectionSection = () => {
  const projectSettings = useAtomValue(projectSettingsAtom);
  const { projection } = projectSettings;
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const setDialogState = useSetAtom(dialogAtom);
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
      onImportWithProjection: () => {
        setDialogState(null);
      },
      filename: "",
      flowUnits: chooseUnitSystem(projectSettings.units),
    });
  };

  return (
    <Section title="Projection">
      <InlineField name="Type" labelSize="sm" layout="fixed-label">
        <span className="flex items-center gap-1 text-sm">
          {projectionTypeLabel(projection)}
          {isXYGrid && <WarningIcon size="sm" className="text-orange-500" />}
        </span>
      </InlineField>
      {!isXYGrid && (
        <InlineField
          name="Name"
          labelSize="sm"
          layout="fixed-label"
          align="start"
        >
          <span className="text-sm">
            {projection.type === "wgs84"
              ? "WGS 84 (EPSG:4326)"
              : `${projection.name} (${projection.id})`}
          </span>
        </InlineField>
      )}
      {projection.type !== "wgs84" && (
        <Button
          variant="default"
          size="sm"
          className="w-full justify-center mt-2"
          onClick={handleOpenProjectionDialog}
        >
          {isXYGrid ? "Project network" : "Change projection"}
        </Button>
      )}
    </Section>
  );
};
