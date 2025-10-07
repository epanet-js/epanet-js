import type { IWrappedFeature } from "src/types";
import React from "react";
import { RawEditor } from "./feature-editor/raw-editor";
import { Asset } from "src/hydraulic-model";
import { isDebugOn } from "src/infra/debug-mode";
import { Quantities } from "src/model-metadata/quantities-spec";
import { AssetPanel } from "./asset-panel";

export function AssetEditor({
  selectedFeature,
  quantitiesMetadata,
}: {
  selectedFeature: IWrappedFeature;
  quantitiesMetadata: Quantities;
}) {
  return (
    <>
      <div className="flex-auto overflow-y-auto placemark-scrollbar">
        <AssetPanel
          asset={selectedFeature as Asset}
          quantitiesMetadata={quantitiesMetadata}
        />
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-900 border-t border-gray-200 dark:border-gray-900 overflow-auto placemark-scrollbar">
        {isDebugOn && <RawEditor feature={selectedFeature} />}
      </div>
    </>
  );
}
