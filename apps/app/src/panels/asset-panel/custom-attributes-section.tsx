import { useCallback, useMemo } from "react";
import { useAtomValue } from "jotai";
import {
  type CustomAttributeAssetType,
  type CustomAttributeId,
  type CustomAttributeValue,
  getAttributes,
} from "@epanet-js/hydraulic-model";
import { Asset } from "src/hydraulic-model";
import type {
  ChangeableProperty,
  ChangeablePropertyValue,
} from "@epanet-js/hydraulic-model-operations";
import { useTranslate } from "src/hooks/use-translate";
import { useAssetComparison } from "src/hooks/use-asset-comparison";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { SectionWrapper } from "./ui-components";
import { CustomAttributeRow } from "../custom-attribute-row";

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
  readonly = false,
  onPropertyChange,
}: {
  asset: Asset;
  type: CustomAttributeAssetType;
  readonly?: boolean;
  onPropertyChange: OnPropertyChange;
}) => {
  const translate = useTranslate();
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
            readOnly={readonly}
            onChange={handleChange}
          />
        );
      })}
    </SectionWrapper>
  );
};
