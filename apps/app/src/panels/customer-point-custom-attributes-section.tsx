import { useCallback } from "react";
import { useAtomValue } from "jotai";
import {
  type CustomAttribute,
  type CustomAttributeId,
  type CustomAttributeValue,
  getAttributes,
} from "@epanet-js/custom-attributes";
import type { CustomerPoint } from "@epanet-js/hydraulic-model";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { changeCustomerPointProperty } from "src/hydraulic-model/model-operations";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { InlineField } from "src/components/form/fields";
import { NumericField } from "src/components/form/numeric-field";
import { EditableTextField } from "src/components/form/editable-text-field";
import { SectionWrapper } from "./asset-panel/ui-components";

export const CustomerPointCustomAttributesSection = ({
  customerPoint,
  readOnly = false,
}: {
  customerPoint: CustomerPoint;
  readOnly?: boolean;
}) => {
  const isCustomAttributesOn = useFeatureFlag("FLAG_CUSTOM_ATTRIBUTES");
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { transact } = useMomentTransaction();

  const handleChange = useCallback(
    (attributeId: CustomAttributeId, value: CustomAttributeValue) => {
      transact(
        changeCustomerPointProperty(hydraulicModel, {
          customerPointIds: [customerPoint.id],
          property: attributeId,
          value,
        }),
      );
    },
    [transact, hydraulicModel, customerPoint.id],
  );

  if (!isCustomAttributesOn) return null;

  const attributes = getAttributes(
    hydraulicModel.customAttributes,
    "customerPoint",
  );
  if (attributes.length === 0) return null;

  return (
    <SectionWrapper title="Custom attributes" section="customAttributes">
      {attributes.map((attribute) => (
        <CustomAttributeRow
          key={attribute.id}
          attribute={attribute}
          value={
            (customerPoint.getProperty(attribute.id) ??
              null) as CustomAttributeValue
          }
          readOnly={readOnly}
          onChange={handleChange}
        />
      ))}
    </SectionWrapper>
  );
};

const CustomAttributeRow = ({
  attribute,
  value,
  readOnly,
  onChange,
}: {
  attribute: CustomAttribute;
  value: CustomAttributeValue;
  readOnly: boolean;
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
    </InlineField>
  );
};
