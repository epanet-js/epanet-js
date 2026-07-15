import { useCallback } from "react";
import { useAtomValue } from "jotai";
import {
  type CustomAttribute,
  type CustomAttributeId,
  type CustomAttributeValue,
  getAttribute,
  getAttributes,
} from "@epanet-js/hydraulic-model";
import type { CustomerPoint } from "@epanet-js/hydraulic-model";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { useCustomerPointComparison } from "src/hooks/use-customer-point-comparison";
import type { PropertyComparison } from "src/hooks/use-asset-comparison";
import { changeCustomerPointProperty } from "src/hydraulic-model/model-operations";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { NumericField } from "src/components/form/numeric-field";
import { EditableTextField } from "src/components/form/editable-text-field";
import {
  PaywalledInlineField,
  SectionWrapper,
} from "./asset-panel/ui-components";

export const CustomerPointCustomAttributesSection = ({
  customerPoint,
  readOnly = false,
}: {
  customerPoint: CustomerPoint;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const isCustomAttributesOn = useFeatureFlag("FLAG_CUSTOM_ATTRIBUTES");
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { transact } = useMomentTransaction();
  const userTracking = useUserTracking();
  const { getComparison } = useCustomerPointComparison(customerPoint.id);

  const handleChange = useCallback(
    (attributeId: CustomAttributeId, value: CustomAttributeValue) => {
      transact(
        changeCustomerPointProperty(hydraulicModel, {
          customerPointIds: [customerPoint.id],
          property: attributeId,
          value,
        }),
      );
      const attribute = getAttribute(
        hydraulicModel.customAttributes,
        "customerPoint",
        attributeId,
      );
      userTracking.capture({
        name: "customAttribute.edited",
        assetType: "customerPoint",
        attributeType: attribute?.type ?? "text",
        property: attributeId,
        label: attribute?.label ?? "",
      });
    },
    [transact, hydraulicModel, customerPoint.id, userTracking],
  );

  if (!isCustomAttributesOn) return null;

  const attributes = getAttributes(
    hydraulicModel.customAttributes,
    "customerPoint",
  );
  if (attributes.length === 0) return null;

  const hasChanged = attributes.some((attribute) => {
    const value = (customerPoint.getProperty(attribute.id) ??
      null) as CustomAttributeValue;
    return getComparison(attribute.id, value).hasChanged;
  });

  return (
    <SectionWrapper
      title={translate("customAttributes.title")}
      section="customAttributes"
      hasChanged={hasChanged}
    >
      {attributes.map((attribute) => {
        const value = (customerPoint.getProperty(attribute.id) ??
          null) as CustomAttributeValue;
        return (
          <CustomAttributeRow
            key={attribute.id}
            attribute={attribute}
            value={value}
            comparison={getComparison(attribute.id, value)}
            readOnly={readOnly}
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
  readOnly,
  onChange,
}: {
  attribute: CustomAttribute;
  value: CustomAttributeValue;
  comparison: PropertyComparison;
  readOnly: boolean;
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
          disabled={readOnly}
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
          disabled={readOnly}
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
