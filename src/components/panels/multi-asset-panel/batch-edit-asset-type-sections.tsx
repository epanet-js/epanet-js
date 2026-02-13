import { useTranslate } from "src/hooks/use-translate";
import { Section, SectionList } from "src/components/form/fields";
import { ReadOnlyMultiValueRow } from "./readonly-multi-value-row";
import { BatchEditableRow } from "./batch-editable-row";
import { AssetPropertySections } from "./data";
import { BATCH_EDITABLE_PROPERTIES } from "./batch-edit-property-config";
import { Asset, AssetId } from "src/hydraulic-model";

type SectionProps = {
  sections: AssetPropertySections;
  assetType: Asset["type"];
  hasSimulation?: boolean;
  onPropertyChange: (
    modelProperty: string,
    value: number | string | boolean,
  ) => void;
  readonly?: boolean;
  onSelectAssets?: (assetIds: AssetId[], property: string) => void;
};

export function BatchEditAssetTypeSections({
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
                  <BatchEditableRow
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
                  name={stat.property}
                  propertyStats={stat}
                  unit={stat.type === "quantity" ? stat.unit : undefined}
                  decimals={
                    stat.type === "quantity" ? stat.decimals : undefined
                  }
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
