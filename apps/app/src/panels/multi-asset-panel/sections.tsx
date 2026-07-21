import { type ReactNode } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { Section, SectionList } from "src/components/form/fields";
import { SummaryValueRow, ReadOnlySummaryValueRow } from "./summary-value-row";
import { AssetPropertySections } from "./asset-stats";
import type { PropertyStats as DetailedPropertyStats } from "./stats";
import type { PropertyStats as SummaryPropertyStats } from "./summary-stats";
import type {
  CustomerPointPropertySections,
  CustomerPointPropertySummarySections,
} from "./customer-point-stats";
import type { EditableProperties } from "./batch-edit-property-config";
import { AssetId } from "src/hydraulic-model";
import {
  type Curves,
  type CurveType,
  type Patterns,
  type PatternType,
  type LabelManager,
} from "@epanet-js/hydraulic-model";
import type { ChangeableProperty } from "src/hydraulic-model/model-operations/change-property";

type AssetSectionProps = {
  sections: AssetPropertySections;
  editableProperties: EditableProperties;
  hasSimulation?: boolean;
  onPropertyChange: (
    modelProperty: ChangeableProperty,
    value: number | string | boolean | null | undefined,
  ) => void;
  readonly?: boolean;
  onSelectAssets?: (assetIds: AssetId[], property: string) => void;
  onRequestDetails?: (property: string) => DetailedPropertyStats | null;
  curves?: Curves;
  patterns?: Patterns;
  labelManager?: LabelManager;
  onOpenLibrary?: (
    library: "curves" | "patterns" | "pumps",
    filterByType?: CurveType | PatternType,
  ) => void;
  customAttributes?: ReactNode;
};

export function AssetTypeSections({
  sections,
  editableProperties,
  hasSimulation = false,
  onPropertyChange,
  readonly = false,
  onSelectAssets,
  onRequestDetails,
  curves,
  patterns,
  labelManager,
  onOpenLibrary,
  customAttributes,
}: AssetSectionProps) {
  const translate = useTranslate();

  const isEditableSection = (sectionKey: keyof AssetPropertySections) =>
    sectionKey === "modelAttributes" ||
    sectionKey === "activeTopology" ||
    sectionKey === "quality" ||
    sectionKey === "energy";

  const renderStatSection = (sectionKey: keyof AssetPropertySections) => {
    const length = sections[sectionKey].length;

    const isResults =
      sectionKey === "simulationResults" || sectionKey === "energyResults";
    const sectionEmpty = length === 0 || (isResults && !hasSimulation);

    if (sectionEmpty) return null;

    return (
      <Section
        key={sectionKey}
        title={translate(sectionKey)}
        variant="secondary"
      >
        {sections[sectionKey].map((stat) => {
          const config = isEditableSection(sectionKey)
            ? editableProperties[stat.property]
            : undefined;

          return config ? (
            <SummaryValueRow
              key={stat.property}
              propertyStats={stat}
              config={config}
              onPropertyChange={onPropertyChange}
              readonly={readonly}
              onSelectAssets={onSelectAssets}
              onRequestDetails={onRequestDetails}
              curves={curves}
              patterns={patterns}
              labelManager={labelManager}
              onOpenLibrary={onOpenLibrary}
            />
          ) : (
            <ReadOnlySummaryValueRow
              key={stat.property}
              propertyStats={stat}
              onSelectAssets={onSelectAssets}
              onRequestDetails={onRequestDetails}
            />
          );
        })}
      </Section>
    );
  };

  return (
    <SectionList overflow={false}>
      {renderStatSection("activeTopology")}
      {renderStatSection("modelAttributes")}
      {customAttributes}
      {renderStatSection("energy")}
      {renderStatSection("demands")}
      {renderStatSection("quality")}
      {renderStatSection("energyResults")}
      {renderStatSection("simulationResults")}
    </SectionList>
  );
}

export function CustomerPointSection({
  sections,
  onSelectCustomerPoints,
  onRequestDetails,
  customAttributes,
}: {
  sections:
    | CustomerPointPropertySections
    | CustomerPointPropertySummarySections;
  onSelectCustomerPoints?: (ids: number[], property: string) => void;
  onRequestDetails?: (
    property: string,
  ) => Promise<DetailedPropertyStats | null>;
  customAttributes?: ReactNode;
}) {
  const translate = useTranslate();

  const renderStatSection = (
    sectionKey: keyof CustomerPointPropertySections,
  ) => {
    const stats = sections[sectionKey];

    if (stats.length === 0) return null;

    return (
      <Section
        key={sectionKey}
        title={translate(sectionKey)}
        variant="secondary"
      >
        {(stats as SummaryPropertyStats[]).map((stat) => (
          <ReadOnlySummaryValueRow
            key={stat.property}
            propertyStats={stat}
            onSelectAssets={onSelectCustomerPoints}
            onRequestDetails={onRequestDetails}
          />
        ))}
      </Section>
    );
  };

  return (
    <SectionList overflow={false}>
      {renderStatSection("connections")}
      {customAttributes}
      {renderStatSection("demands")}
    </SectionList>
  );
}
