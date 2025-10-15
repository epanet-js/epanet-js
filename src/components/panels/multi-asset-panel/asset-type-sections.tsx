import { useTranslate } from "src/hooks/use-translate";
import { Section } from "src/components/form/fields";
import { MultiValueRow } from "./multi-value-row";
import { AssetPropertySections } from "./data";

type SectionProps = {
  sections: AssetPropertySections;
  hasSimulation?: boolean;
};

export function JunctionSection({
  sections,
  hasSimulation = false,
}: SectionProps) {
  const translate = useTranslate();

  return (
    <>
      <Section title={translate("modelAttributes")}>
        {sections.modelAttributes.map((stat) => (
          <MultiValueRow
            key={stat.property}
            name={stat.property}
            propertyStats={stat}
            unit={stat.type === "quantity" ? stat.unit : undefined}
            decimals={stat.type === "quantity" ? stat.decimals : undefined}
          />
        ))}
      </Section>
      <Section title={translate("demands")}>
        {sections.demands.map((stat) => (
          <MultiValueRow
            key={stat.property}
            name={stat.property}
            propertyStats={stat}
            unit={stat.type === "quantity" ? stat.unit : undefined}
            decimals={stat.type === "quantity" ? stat.decimals : undefined}
          />
        ))}
      </Section>
      {hasSimulation && (
        <Section title={translate("simulationResults")}>
          {sections.simulationResults.map((stat) => (
            <MultiValueRow
              key={stat.property}
              name={stat.property}
              propertyStats={stat}
              unit={stat.type === "quantity" ? stat.unit : undefined}
              decimals={stat.type === "quantity" ? stat.decimals : undefined}
            />
          ))}
        </Section>
      )}
    </>
  );
}

export function PipeSection({ sections, hasSimulation = false }: SectionProps) {
  const translate = useTranslate();

  return (
    <>
      <Section title={translate("modelAttributes")}>
        {sections.modelAttributes.map((stat) => (
          <MultiValueRow
            key={stat.property}
            name={stat.property}
            propertyStats={stat}
            unit={stat.type === "quantity" ? stat.unit : undefined}
            decimals={stat.type === "quantity" ? stat.decimals : undefined}
          />
        ))}
      </Section>
      {hasSimulation && (
        <Section title={translate("simulationResults")}>
          {sections.simulationResults.map((stat) => (
            <MultiValueRow
              key={stat.property}
              name={stat.property}
              propertyStats={stat}
              unit={stat.type === "quantity" ? stat.unit : undefined}
              decimals={stat.type === "quantity" ? stat.decimals : undefined}
            />
          ))}
        </Section>
      )}
    </>
  );
}

export function PumpSection({ sections, hasSimulation = false }: SectionProps) {
  const translate = useTranslate();

  return (
    <>
      <Section title={translate("modelAttributes")}>
        {sections.modelAttributes.map((stat) => (
          <MultiValueRow
            key={stat.property}
            name={stat.property}
            propertyStats={stat}
            unit={stat.type === "quantity" ? stat.unit : undefined}
            decimals={stat.type === "quantity" ? stat.decimals : undefined}
          />
        ))}
      </Section>
      {hasSimulation && (
        <Section title={translate("simulationResults")}>
          {sections.simulationResults.map((stat) => (
            <MultiValueRow
              key={stat.property}
              name={stat.property}
              propertyStats={stat}
              unit={stat.type === "quantity" ? stat.unit : undefined}
              decimals={stat.type === "quantity" ? stat.decimals : undefined}
            />
          ))}
        </Section>
      )}
    </>
  );
}

export function ValveSection({
  sections,
  hasSimulation = false,
}: SectionProps) {
  const translate = useTranslate();

  return (
    <>
      <Section title={translate("modelAttributes")}>
        {sections.modelAttributes.map((stat) => (
          <MultiValueRow
            key={stat.property}
            name={stat.property}
            propertyStats={stat}
            unit={stat.type === "quantity" ? stat.unit : undefined}
            decimals={stat.type === "quantity" ? stat.decimals : undefined}
          />
        ))}
      </Section>
      {hasSimulation && (
        <Section title={translate("simulationResults")}>
          {sections.simulationResults.map((stat) => (
            <MultiValueRow
              key={stat.property}
              name={stat.property}
              propertyStats={stat}
              unit={stat.type === "quantity" ? stat.unit : undefined}
              decimals={stat.type === "quantity" ? stat.decimals : undefined}
            />
          ))}
        </Section>
      )}
    </>
  );
}

export function ReservoirSection({
  sections,
}: Omit<SectionProps, "hasSimulation">) {
  const translate = useTranslate();

  return (
    <Section title={translate("modelAttributes")}>
      {sections.modelAttributes.map((stat) => (
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
}

export function TankSection({ sections, hasSimulation = false }: SectionProps) {
  const translate = useTranslate();

  return (
    <>
      <Section title={translate("modelAttributes")}>
        {sections.modelAttributes.map((stat) => (
          <MultiValueRow
            key={stat.property}
            name={stat.property}
            propertyStats={stat}
            unit={stat.type === "quantity" ? stat.unit : undefined}
            decimals={stat.type === "quantity" ? stat.decimals : undefined}
          />
        ))}
      </Section>
      {hasSimulation && (
        <Section title={translate("simulationResults")}>
          {sections.simulationResults.map((stat) => (
            <MultiValueRow
              key={stat.property}
              name={stat.property}
              propertyStats={stat}
              unit={stat.type === "quantity" ? stat.unit : undefined}
              decimals={stat.type === "quantity" ? stat.decimals : undefined}
            />
          ))}
        </Section>
      )}
    </>
  );
}
