import React, { useRef } from "react";
import { PropertyRowReadonly } from "./property_row";
import type { IWrappedFeature } from "src/types";
import sortBy from "lodash/sortBy";

import { onArrow } from "src/lib/arrow_navigation";
import { translate } from "src/infra/i18n";

export function PropertyTableHead() {
  return (
    <thead>
      <tr className="bg-gray-100 dark:bg-gray-800 font-sans text-gray-500 dark:text-gray-100 text-xs text-left">
        <th className="pl-3 py-2 border-r border-t border-b border-gray-200 dark:border-gray-700">
          {translate("property")}
        </th>
        <th className="pl-2 py-2 border-l border-t border-b border-gray-200 dark:border-gray-700">
          {translate("value")}
        </th>
      </tr>
    </thead>
  );
}

export function FeatureEditorPropertiesReadonly({
  wrappedFeature,
}: {
  wrappedFeature: IWrappedFeature;
}) {
  const {
    feature: { properties },
  } = wrappedFeature;

  const localOrder = useRef<string[]>(
    Object.keys({
      ...(properties || {}),
    }),
  );

  const pairs = sortBy(
    Object.entries({
      ...(properties || {}),
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
          {pairs.map((pair) => {
            return <PropertyRowReadonly key={pair[0]} pair={pair} />;
          })}
        </tbody>
      </table>
    </div>
  );
}
