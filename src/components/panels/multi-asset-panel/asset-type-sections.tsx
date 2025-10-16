import { useTranslate } from "src/hooks/use-translate";
import { Section, SectionList } from "src/components/form/fields";
import { MultiValueRow } from "./multi-value-row";
import { AssetPropertySections } from "./data";

type SectionProps = {
  sections: AssetPropertySections;
  hasSimulation?: boolean;
};

export function AssetTypeSections({
  sections,
  hasSimulation = false,
}: SectionProps) {
  const translate = useTranslate();

  const sectionKeys: Array<keyof AssetPropertySections> = [
    "modelAttributes",
    "demands",
    "simulationResults",
  ];

  return (
    <SectionList padding={0} gap={3}>
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
              />
            ))}
          </Section>
        );
      })}
    </SectionList>
  );
}
