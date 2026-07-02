import { useCallback, useMemo } from "react";
import { useAtomValue } from "jotai";
import {
  type CustomAttribute,
  type CustomAttributeAssetType,
  type CustomAttributeId,
  type CustomAttributeValue,
  customPropertyKey,
  getAttributes,
} from "@epanet-js/custom-attributes";
import { Asset } from "src/hydraulic-model";
import type {
  ChangeableProperty,
  ChangeablePropertyValue,
} from "src/hydraulic-model/model-operations/change-property";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { InlineField } from "src/components/form/fields";
import { NumericField } from "src/components/form/numeric-field";
import { EditableTextField } from "src/components/form/editable-text-field";
import { SectionWrapper } from "./ui-components";

type OnPropertyChange = <P extends ChangeableProperty>(
  name: P,
  value: ChangeablePropertyValue<P>,
  oldValue: ChangeablePropertyValue<P>,
) => void;

type CustomChange = (
  property: string,
  value: CustomAttributeValue,
  oldValue: CustomAttributeValue,
) => void;

export const CustomAttributesSection = ({
  asset,
  type,
  onPropertyChange,
}: {
  asset: Asset;
  type: CustomAttributeAssetType;
  onPropertyChange: OnPropertyChange;
}) => {
  const isCustomAttributesOn = useFeatureFlag("FLAG_CUSTOM_ATTRIBUTES");
  const { customAttributes } = useAtomValue(stagingModelDerivedAtom);

  const attributes = useMemo(
    () => getAttributes(customAttributes, type),
    [customAttributes, type],
  );

  const handleChange = useCallback(
    (attributeId: CustomAttributeId, value: CustomAttributeValue) => {
      const key = customPropertyKey(attributeId);
      const oldValue = (asset.getProperty(key) ?? null) as CustomAttributeValue;
      (onPropertyChange as unknown as CustomChange)(key, value, oldValue);
    },
    [asset, onPropertyChange],
  );

  if (!isCustomAttributesOn) return null;
  if (attributes.length === 0) return null;

  return (
    <SectionWrapper title="Custom attributes" section="customAttributes">
      {attributes.map((attribute) => (
        <CustomAttributeRow
          key={attribute.id}
          attribute={attribute}
          value={
            (asset.getProperty(customPropertyKey(attribute.id)) ??
              null) as CustomAttributeValue
          }
          onChange={handleChange}
        />
      ))}
    </SectionWrapper>
  );
};

const CustomAttributeRow = ({
  attribute,
  value,
  onChange,
}: {
  attribute: CustomAttribute;
  value: CustomAttributeValue;
  onChange: (
    attributeId: CustomAttributeId,
    value: CustomAttributeValue,
  ) => void;
}) => {
  const displayValue = value == null ? "" : String(value);

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
