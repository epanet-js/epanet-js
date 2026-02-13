import { useTranslate } from "src/hooks/use-translate";
import { Section, SectionList } from "src/components/form/fields";
import { MultiValueRow } from "./multi-value-row";
import { AssetPropertySections } from "./data";
import { AssetId } from "src/hydraulic-model";

type SectionProps = {
  sections: AssetPropertySections;
  hasSimulation?: boolean;
  onSelectAssets?: (assetIds: AssetId[], property: string) => void;
};

export function AssetTypeSections({
  sections,
  hasSimulation = false,
  onSelectAssets,
}: SectionProps) {
  const translate = useTranslate();

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
            {stats.map((stat) => (
              <MultiValueRow
                key={stat.property}
                name={stat.property}
                propertyStats={stat}
                unit={stat.type === "quantity" ? stat.unit : undefined}
                decimals={stat.type === "quantity" ? stat.decimals : undefined}
                onSelectAssets={onSelectAssets}
              />
            ))}
          </Section>
        );
      })}
    </SectionList>
  );
}
