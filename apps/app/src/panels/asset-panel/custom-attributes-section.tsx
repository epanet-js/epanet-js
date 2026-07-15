import { useCallback, useMemo } from "react";
import { useAtomValue } from "jotai";
import {
  type CustomAttribute,
  type CustomAttributeAssetType,
  type CustomAttributeId,
  type CustomAttributeValue,
  getAttributes,
} from "@epanet-js/custom-attributes";
import { Asset } from "src/hydraulic-model";
import type {
  ChangeableProperty,
  ChangeablePropertyValue,
} from "src/hydraulic-model/model-operations/change-property";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useTranslate } from "src/hooks/use-translate";
import {
  useAssetComparison,
  type PropertyComparison,
} from "src/hooks/use-asset-comparison";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { NumericField } from "src/components/form/numeric-field";
import { EditableTextField } from "src/components/form/editable-text-field";
import { PaywalledInlineField, SectionWrapper } from "./ui-components";

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
  const translate = useTranslate();
  const isCustomAttributesOn = useFeatureFlag("FLAG_CUSTOM_ATTRIBUTES");
  const { customAttributes } = useAtomValue(stagingModelDerivedAtom);
  const { getComparison } = useAssetComparison(asset);

  const attributes = useMemo(
    () => getAttributes(customAttributes, type),
    [customAttributes, type],
  );

  const hasChanged = attributes.some((attribute) => {
    const key = attribute.id;
    return getComparison(key, asset.getProperty(key) ?? null).hasChanged;
  });

  const handleChange = useCallback(
    (attributeId: CustomAttributeId, value: CustomAttributeValue) => {
      const key = attributeId;
      const oldValue = (asset.getProperty(key) ?? null) as CustomAttributeValue;
      (onPropertyChange as unknown as CustomChange)(key, value, oldValue);
    },
    [asset, onPropertyChange],
  );

  if (!isCustomAttributesOn) return null;
  if (attributes.length === 0) return null;

  return (
    <SectionWrapper
      title={translate("customAttributes.title")}
      section="customAttributes"
      hasChanged={hasChanged}
    >
      {attributes.map((attribute) => {
        const value = (asset.getProperty(attribute.id) ??
          null) as CustomAttributeValue;
        return (
          <CustomAttributeRow
            key={attribute.id}
            attribute={attribute}
            value={value}
            comparison={getComparison(attribute.id, value)}
            onChange={handleChange}
          />
        );
      })}
    </SectionWrapper>
  );
};

const CustomAttributeRow = ({
  attribute,
  value,
  comparison,
  onChange,
}: {
  attribute: CustomAttribute;
  value: CustomAttributeValue;
  comparison: PropertyComparison;
  onChange: (
    attributeId: CustomAttributeId,
    value: CustomAttributeValue,
  ) => void;
}) => {
  const translate = useTranslate();
  const displayValue = value == null ? "" : String(value);

  const baseDisplayValue = comparison.hasChanged
    ? comparison.baseValue != null
      ? String(comparison.baseValue)
      : translate("none")
    : undefined;

  return (
    <PaywalledInlineField
      name={attribute.label}
      labelSize="md"
      hasChanged={comparison.hasChanged}
      baseDisplayValue={baseDisplayValue}
      paywall="customAttributes"
    >
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
    </PaywalledInlineField>
  );
};
