import type {
  CustomAttribute,
  CustomAttributeId,
  CustomAttributeValue,
} from "@epanet-js/hydraulic-model";
import { useTranslate } from "src/hooks/use-translate";
import type { PropertyComparison } from "src/hooks/use-asset-comparison";
import { NumericField } from "src/components/form/numeric-field";
import { EditableTextField } from "src/components/form/editable-text-field";
import { PaywalledInlineField } from "./asset-panel/ui-components";

export const CustomAttributeRow = ({
  attribute,
  value,
  comparison,
  readOnly = false,
  onChange,
}: {
  attribute: CustomAttribute;
  value: CustomAttributeValue;
  comparison: PropertyComparison;
  readOnly?: boolean;
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
