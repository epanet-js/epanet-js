import { type ReactNode } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { Section, SectionList } from "src/components/form/fields";
import { ReadOnlyMultiValueRow } from "./readonly-multi-value-row";
import { MultiValueRow } from "./multi-value-row";
import { SummaryValueRow, ReadOnlySummaryValueRow } from "./summary-value-row";
import { AssetPropertySections } from "./asset-stats";
import type { AssetPropertySectionsDeprecated } from "./asset-stats-deprecated";
import type { PropertyStats as DetailedPropertyStats } from "./stats";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import type { CustomerPointPropertySections } from "./customer-point-stats";
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
  sectionsDeprecated: AssetPropertySectionsDeprecated;
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
  sectionsDeprecated,
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
  const isStatsPerfOn = useFeatureFlag("FLAG_STATS_PERF");

  const isEditableSection = (sectionKey: keyof AssetPropertySections) =>
    sectionKey === "modelAttributes" ||
    sectionKey === "activeTopology" ||
    sectionKey === "quality" ||
    sectionKey === "energy";

  const renderStatSection = (sectionKey: keyof AssetPropertySections) => {
    const length = isStatsPerfOn
      ? sections[sectionKey].length
      : sectionsDeprecated[sectionKey].length;

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
        {isStatsPerfOn
          ? sections[sectionKey].map((stat) => {
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
            })
          : sectionsDeprecated[sectionKey].map((stat) => {
              const config = isEditableSection(sectionKey)
                ? editableProperties[stat.property]
                : undefined;

              return config ? (
                <MultiValueRow
                  key={stat.property}
                  propertyStats={stat}
                  config={config}
                  onPropertyChange={onPropertyChange}
                  readonly={readonly}
                  onSelectAssets={onSelectAssets}
                  curves={curves}
                  patterns={patterns}
                  labelManager={labelManager}
                  onOpenLibrary={onOpenLibrary}
                />
              ) : (
                <ReadOnlyMultiValueRow
                  key={stat.property}
                  propertyStats={stat}
                  onSelectAssets={onSelectAssets}
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
  customAttributes,
}: {
  sections: CustomerPointPropertySections;
  onSelectCustomerPoints?: (ids: number[], property: string) => void;
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
        {stats.map((stat) => (
          <ReadOnlyMultiValueRow
            key={stat.property}
            propertyStats={stat}
            onSelectAssets={onSelectCustomerPoints}
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
