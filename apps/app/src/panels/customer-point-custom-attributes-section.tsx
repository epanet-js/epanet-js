import { useCallback } from "react";
import { useAtomValue } from "jotai";
import {
  type CustomAttributeId,
  type CustomAttributeValue,
  type CustomerPoint,
  getAttribute,
  getAttributes,
} from "@epanet-js/hydraulic-model";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { useCustomerPointComparison } from "src/hooks/use-customer-point-comparison";
import { changeCustomerPointProperty } from "@epanet-js/hydraulic-model-operations";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { SectionWrapper } from "./asset-panel/ui-components";
import { CustomAttributeRow } from "./custom-attribute-row";

export const CustomerPointCustomAttributesSection = ({
  customerPoint,
  readOnly = false,
}: {
  customerPoint: CustomerPoint;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { transact } = useModelTransaction();
  const userTracking = useUserTracking();
  const { getComparison } = useCustomerPointComparison(customerPoint.id);

  const handleChange = useCallback(
    (attributeId: CustomAttributeId, value: CustomAttributeValue) => {
      const data = {
        customerPointIds: [customerPoint.id],
        property: attributeId,
        value,
      };
      transact(() => changeCustomerPointProperty(hydraulicModel, data));
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
