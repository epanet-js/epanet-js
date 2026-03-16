import { useTranslate } from "src/hooks/use-translate";
import { Section, SectionList } from "src/components/form/fields";
import { ReadOnlyMultiValueRow } from "./readonly-multi-value-row";
import { MultiValueRow } from "./multi-value-row";
import { AssetPropertySections } from "./data";
import type { EditableProperties } from "./batch-edit-property-config";
import { AssetId } from "src/hydraulic-model";
import type { ChangeableProperty } from "src/hydraulic-model/model-operations/change-property";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

type SectionProps = {
  sections: AssetPropertySections;
  editableProperties: EditableProperties;
  hasSimulation?: boolean;
  onPropertyChange: (
    modelProperty: ChangeableProperty,
    value: number | string | boolean,
  ) => void;
  readonly?: boolean;
  onSelectAssets?: (assetIds: AssetId[], property: string) => void;
};

export function AssetTypeSections({
  sections,
  editableProperties,
  hasSimulation = false,
  onPropertyChange,
  readonly = false,
  onSelectAssets,
}: SectionProps) {
  const useAutoIndentation = useFeatureFlag("FLAG_UI_COLLAPSIBLE");
  const translate = useTranslate();

  const sectionKeys: Array<keyof AssetPropertySections> = [
    "activeTopology",
    "modelAttributes",
    "energy",
    "demands",
    "energyResults",
    "simulationResults",
  ];

  return (
    <SectionList padding={0} gap={useAutoIndentation ? 1 : 3} overflow={false}>
      {sectionKeys.map((sectionKey) => {
        const stats = sections[sectionKey];

        if (stats.length === 0) return null;

        if (
          (sectionKey === "simulationResults" ||
            sectionKey === "energyResults") &&
          !hasSimulation
        )
          return null;

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
      })}
    </SectionList>
  );
}
