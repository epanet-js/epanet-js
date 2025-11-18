import { useTranslate } from "src/hooks/use-translate";
import { Section, SectionList } from "src/components/form/fields";
import { MultiValueRow } from "./multi-value-row";
import { AssetPropertySections } from "./data";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { Asset } from "src/hydraulic-model";

type SectionProps = {
  sections: AssetPropertySections;
  hasSimulation?: boolean;
  assetType?: Asset["type"];
};

export function AssetTypeSections({
  sections,
  hasSimulation = false,
  assetType,
}: SectionProps) {
  const translate = useTranslate();
  const isActiveTopologyEnabled = useFeatureFlag("FLAG_ACTIVE_TOPOLOGY");
  const isPipeCustomerPointsEnabled = useFeatureFlag(
    "FLAG_PIPE_CUSTOMER_POINTS",
  );

  const sectionKeys: Array<keyof AssetPropertySections> =
    isActiveTopologyEnabled
      ? ["activeTopology", "modelAttributes", "demands", "simulationResults"]
      : ["modelAttributes", "demands", "simulationResults"];

  return (
    <SectionList padding={0} gap={3} overflow={false}>
      {sectionKeys.map((sectionKey) => {
        const stats = sections[sectionKey];

        if (stats.length === 0) return null;

        if (sectionKey === "simulationResults" && !hasSimulation) return null;

        if (
          sectionKey === "demands" &&
          assetType === "pipe" &&
          !isPipeCustomerPointsEnabled
        ) {
          return null;
        }

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
