import { type ReactNode } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { Section, SectionList } from "src/components/form/fields";
import { ReadOnlyMultiValueRow } from "./readonly-multi-value-row";
import { MultiValueRow } from "./multi-value-row";
import { AssetPropertySections } from "./asset-stats";
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
  editableProperties: EditableProperties;
  hasSimulation?: boolean;
  onPropertyChange: (
    modelProperty: ChangeableProperty,
    value: number | string | boolean | null | undefined,
  ) => void;
  readonly?: boolean;
  onSelectAssets?: (assetIds: AssetId[], property: string) => void;
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
  curves,
  patterns,
  labelManager,
  onOpenLibrary,
  customAttributes,
}: AssetSectionProps) {
  const translate = useTranslate();

  const renderStatSection = (sectionKey: keyof AssetPropertySections) => {
    const stats = sections[sectionKey];

    const isResults =
      sectionKey === "simulationResults" || sectionKey === "energyResults";
    const sectionEmpty = stats.length === 0 || (isResults && !hasSimulation);

    if (sectionEmpty) return null;

    return (
      <Section
        key={sectionKey}
        title={translate(sectionKey)}
        variant="secondary"
      >
        {stats.map((stat) => {
          const config =
            sectionKey === "modelAttributes" ||
            sectionKey === "activeTopology" ||
            sectionKey === "quality" ||
            sectionKey === "energy"
              ? editableProperties[stat.property]
              : undefined;

          if (config) {
            return (
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
            );
          }

          return (
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
