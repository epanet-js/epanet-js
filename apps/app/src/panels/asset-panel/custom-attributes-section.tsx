import { useAtomValue } from "jotai";
import type {
  CustomAttributeAssetType,
  ResolvedCustomAttribute,
} from "@epanet-js/custom-attributes";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { customAttributesAtom } from "src/state/custom-attributes";
import { InlineField } from "src/components/form/fields";
import { NumericField } from "src/components/form/numeric-field";
import { EditableTextField } from "src/components/form/editable-text-field";
import { SectionWrapper } from "./ui-components";

export const CustomAttributesSection = ({
  id,
  type,
}: {
  id: number;
  type: CustomAttributeAssetType;
}) => {
  const isCustomAttributesOn = useFeatureFlag("FLAG_CUSTOM_ATTRIBUTES");
  const customAttributes = useAtomValue(customAttributesAtom);

  if (!isCustomAttributesOn) return null;

  const attributes = customAttributes.getAttributesFor(id, type);
  if (attributes.length === 0) return null;

  return (
    <SectionWrapper title="Custom attributes" section="customAttributes">
      {attributes.map((attribute) => (
        <CustomAttributeRow key={attribute.id} attribute={attribute} />
      ))}
    </SectionWrapper>
  );
};

const CustomAttributeRow = ({
  attribute,
}: {
  attribute: ResolvedCustomAttribute;
}) => {
  return (
    <InlineField name={attribute.label} labelSize="md">
      {attribute.type === "number" ? (
        <NumericField
          label={attribute.label}
          displayValue=""
          disabled
          styleOptions={{ padding: "md", textSize: "sm" }}
        />
      ) : (
        <EditableTextField
          label={attribute.label}
          value=""
          disabled
          styleOptions={{ padding: "md", textSize: "sm" }}
        />
      )}
    </InlineField>
  );
};
