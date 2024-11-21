import type { Feature, IWrappedFeature } from "src/types";
import {
  FeatureEditorProperties,
  PropertyTableHead,
} from "./feature_editor_properties";
import { FeatureEditorId } from "./feature_editor_id";
import { dataAtom, showAllAtom } from "src/state/jotai";
import React, { useMemo, useRef } from "react";
import { RawEditor } from "./raw_editor";
import { useAtomValue } from "jotai";
import { Asset } from "src/hydraulics/asset-types";
import { PanelDetails } from "src/components/panel_details";
import { usePersistence } from "src/lib/persistence/context";
import { translate } from "src/infra/i18n";
import { IPersistence } from "src/lib/persistence/ipersistence";
import { extractPropertyKeys } from "src/lib/multi_properties";
import { JsonValue } from "type-fest";
import { updatePropertyValue } from "src/lib/map_operations_deprecated/update_property_value";
import { captureError } from "src/infra/error-tracking";
import { updatePropertyKey } from "src/lib/map_operations_deprecated/update_property_key";
import without from "lodash/without";
import sortBy from "lodash/sortBy";
import { deletePropertyKey } from "src/lib/map_operations_deprecated/delete_property_key";
import { ExplicitCast, castExplicit } from "src/lib/cast";
import { onArrow } from "src/lib/arrow_navigation";
import { PropertyRow } from "./property_row";
import { isDebugOn } from "src/infra/debug-mode";

export function FeatureEditorInner({
  selectedFeature,
}: {
  selectedFeature: IWrappedFeature;
}) {
  const assetType = selectedFeature.feature.properties?.type;
  return (
    <>
      <div className="flex-auto overflow-y-auto placemark-scrollbar">
        {!!assetType ? (
          <AssetEditor asset={selectedFeature as Asset} />
        ) : (
          <FeatureEditorProperties wrappedFeature={selectedFeature} />
        )}
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-900 border-t border-gray-200 dark:border-gray-900 overflow-auto placemark-scrollbar">
        {isDebugOn && (
          <>
            <FeatureEditorId wrappedFeature={selectedFeature} />
            <RawEditor feature={selectedFeature} />
          </>
        )}
      </div>
    </>
  );
}

const AssetEditor = ({ asset }: { asset: Asset }) => {
  const rep = usePersistence();
  const showAll = useAtomValue(showAllAtom);

  return (
    <PanelDetails title={translate(asset.type)} variant="fullwidth">
      <div className="pb-3 contain-layout">
        <FeatureEditorPropertiesRaw
          wrappedFeature={asset}
          showAll={showAll}
          rep={rep}
          key={`properties-${String(showAll)}`}
        />
      </div>
    </PanelDetails>
  );
};

export function FeatureEditorPropertiesRaw({
  wrappedFeature,
  rep,
  showAll,
}: {
  wrappedFeature: IWrappedFeature;
  rep: IPersistence;
  showAll: boolean;
}) {
  const { featureMapDeprecated } = useAtomValue(dataAtom);
  const { feature } = wrappedFeature;
  const {
    feature: { properties },
  } = wrappedFeature;

  const propertyKeys = extractPropertyKeys(featureMapDeprecated);

  const missingProperties = useMemo(() => {
    const missing: { [key: string]: undefined } = {};
    if (!properties) {
      return propertyKeys;
    }
    for (const propName of propertyKeys) {
      if (!(propName in properties)) {
        missing[propName] = undefined;
      }
    }
    return missing;
  }, [properties, propertyKeys]);

  const transact = rep.useTransactDeprecated();

  const localOrder = useRef<string[]>(
    Object.keys({
      ...(properties || {}),
      ...(showAll ? missingProperties || {} : []),
    }),
  );

  function updateFeature(feature: Feature) {
    return transact({
      putFeatures: [
        {
          ...wrappedFeature,
          feature,
        },
      ],
    });
  }

  const updateValue = (key: string, value: JsonValue) => {
    updateFeature(updatePropertyValue(feature, { key, value })).catch((e) =>
      captureError(e),
    );
  };

  const updateKey = (key: string, newKey: string) => {
    updateFeature(updatePropertyKey(feature, { key, newKey })).catch((e) =>
      captureError(e),
    );
  };

  const deleteKey = (key: string) => {
    localOrder.current = without(localOrder.current, key);
    updateFeature(deletePropertyKey(feature, { key })).catch((e) =>
      captureError(e),
    );
  };

  const castValue = (key: string, value: string, castType: ExplicitCast) => {
    const properties = { ...feature.properties };
    properties[key] = castExplicit(value, castType);
    updateFeature({
      ...feature,
      properties,
    }).catch((e) => captureError(e));
  };

  const pairs = sortBy(
    Object.entries({
      ...(properties || {}),
      ...(showAll ? missingProperties : []),
    }),
    ([key]) => {
      return localOrder.current.indexOf(key);
    },
  );

  return (
    <div
      className="overflow-y-auto placemark-scrollbar"
      data-focus-scope
      onKeyDown={onArrow}
    >
      <table className="pb-2 w-full">
        <PropertyTableHead />
        <tbody>
          {pairs.map((pair, y) => {
            return (
              <PropertyRow
                key={pair[0]}
                pair={pair}
                y={y}
                even={y % 2 === 0}
                onChangeValue={updateValue}
                onChangeKey={updateKey}
                onDeleteKey={deleteKey}
                onCast={castValue}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
