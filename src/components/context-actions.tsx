import { useAtomValue } from "jotai";
import { selectedFeaturesAtom, selectionAtom } from "src/state/jotai";
import React from "react";
import { GeometryActions } from "./context-actions/geometry-actions";
import { CustomerPointActions } from "./context-actions/customer-point-actions";
import { useTranslate } from "src/hooks/use-translate";

export function ContextActions() {
  const translate = useTranslate();
  const selection = useAtomValue(selectionAtom);
  const selectedWrappedFeatures = useAtomValue(selectedFeaturesAtom);

  if (selection.type === "singleCustomerPoint") {
    return (
      <div className="flex items-center">
        <div className="h-12 self-stretch flex items-center text-xs pl-2 pr-1 text-gray-700 dark:text-white">
          {translate("selection")} (
          {translate(
            "contextActions.customerPoints.customerPointSelected",
            "1",
          )}
          )
        </div>
        <CustomerPointActions as="root" />
      </div>
    );
  }

  if (selectedWrappedFeatures.length === 0) return null;

  if (selectedWrappedFeatures.length > 1) return null;

  return (
    <div className="flex items-center">
      <GeometryActions
        selectedWrappedFeatures={selectedWrappedFeatures}
        as="root"
      />
    </div>
  );
}
