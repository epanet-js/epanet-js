import { useAtomValue } from "jotai";
import { projectSettingsAtom } from "src/state/project-settings";
import { Button } from "src/components/elements";
import { Section, InlineField } from "src/components/form/fields";
import { WarningIcon } from "src/icons";
import type { Projection } from "src/lib/projections/projection";

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
  const { projection } = useAtomValue(projectSettingsAtom);
  const isXYGrid = projection.type === "xy-grid";

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
      <Button
        variant="default"
        size="sm"
        className="w-full justify-center mt-2"
        onClick={() => {}}
      >
        {isXYGrid ? "Project network" : "Change projection"}
      </Button>
    </Section>
  );
};
