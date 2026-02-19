import { useTranslate } from "src/hooks/use-translate";
import { Section, SectionList } from "src/components/form/fields";
import { ReadOnlyMultiValueRow } from "./readonly-multi-value-row";
import { MultiValueRow } from "./multi-value-row";
import { AssetPropertySections } from "./data";
import { BATCH_EDITABLE_PROPERTIES } from "./batch-edit-property-config";
import { Asset, AssetId } from "src/hydraulic-model";
import type { ChangeableProperty } from "src/hydraulic-model/model-operations/change-property";

type SectionProps = {
  sections: AssetPropertySections;
  assetType: Asset["type"];
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
  assetType,
  hasSimulation = false,
  onPropertyChange,
  readonly = false,
  onSelectAssets,
}: SectionProps) {
  const translate = useTranslate();
  const editableProperties = BATCH_EDITABLE_PROPERTIES[assetType] ?? {};

  const sectionKeys: Array<keyof AssetPropertySections> = [
    "activeTopology",
    "modelAttributes",
    "demands",
    "simulationResults",
  ];

  return (
    <SectionList padding={0} gap={3} overflow={false}>
      {sectionKeys.map((sectionKey) => {
        const stats = sections[sectionKey];

        if (stats.length === 0) return null;

        if (sectionKey === "simulationResults" && !hasSimulation) return null;

        return (
          <Section
            key={sectionKey}
            title={translate(sectionKey)}
            variant="secondary"
          >
            {stats.map((stat) => {
              const config =
                sectionKey === "modelAttributes" ||
                sectionKey === "activeTopology"
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
