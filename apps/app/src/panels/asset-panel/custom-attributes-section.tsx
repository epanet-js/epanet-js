import { useCallback } from "react";
import { useAtomValue } from "jotai";
import type {
  CustomAttributeAssetType,
  CustomAttributeId,
  CustomAttributeValue,
  ResolvedCustomAttribute,
} from "@epanet-js/custom-attributes";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { changeCustomAttribute } from "src/lib/custom-attributes/change-custom-attribute";
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
  const { transact } = useModelTransaction();

  const handleChange = useCallback(
    (attributeId: CustomAttributeId, value: CustomAttributeValue) => {
      transact(
        changeCustomAttribute({
          assetType: type,
          assetId: id,
          attributeId,
          value,
        }),
      );
    },
    [transact, type, id],
  );

  if (!isCustomAttributesOn) return null;

  const attributes = customAttributes.getAttributesFor(id, type);
  if (attributes.length === 0) return null;

  return (
    <SectionWrapper title="Custom attributes" section="customAttributes">
      {attributes.map((attribute) => (
        <CustomAttributeRow
          key={attribute.id}
          attribute={attribute}
          onChange={handleChange}
        />
      ))}
    </SectionWrapper>
  );
};

const CustomAttributeRow = ({
  attribute,
  onChange,
}: {
  attribute: ResolvedCustomAttribute;
  onChange: (
    attributeId: CustomAttributeId,
    value: CustomAttributeValue,
  ) => void;
}) => {
  const displayValue = attribute.value == null ? "" : String(attribute.value);

  return (
    <InlineField name={attribute.label} labelSize="md">
      {attribute.type === "number" ? (
        <NumericField
          key={displayValue}
          label={attribute.label}
          displayValue={displayValue}
          onChangeValue={(newValue, isEmpty) =>
            onChange(attribute.id, isEmpty ? null : newValue)
          }
          styleOptions={{ padding: "md", textSize: "sm" }}
        />
      ) : (
        <EditableTextField
          key={displayValue}
          label={attribute.label}
          value={displayValue}
          allowEmpty
          onChangeValue={(newValue) => {
            onChange(attribute.id, newValue === "" ? null : newValue);
            return false;
          }}
          styleOptions={{ padding: "md", textSize: "sm" }}
        />
      )}
    </InlineField>
  );
};
