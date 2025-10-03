import * as E from "src/components/elements";
import * as DD from "@radix-ui/react-dropdown-menu";
import { useAtomValue } from "jotai";
import { selectedFeaturesAtom, selectionAtom } from "src/state/jotai";
import * as T from "@radix-ui/react-tooltip";
import React from "react";
import { GeometryActions } from "./context-actions/geometry-actions";
import { CustomerPointActions } from "./context-actions/customer-point-actions";
import { pluralize } from "src/lib/utils";
import { useTranslate } from "src/hooks/use-translate";
import { ChevronDownIcon } from "src/icons";

export function ToolbarTrigger({
  children,
  ...props
}: {
  children: React.ReactNode;
} & React.ComponentProps<typeof T.Trigger>) {
  return (
    <div
      className="h-10 w-12 p-1
          group bn
          flex items-stretch justify-center focus:outline-none"
    >
      <T.Trigger asChild {...props}>
        <DD.Trigger asChild>
          <E.Button variant="quiet">
            {children}
            <ChevronDownIcon />
          </E.Button>
        </DD.Trigger>
      </T.Trigger>
    </div>
  );
}

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

  return (
    <div className="flex items-center">
      {selectedWrappedFeatures.length > 1 && (
        <div className="h-12 self-stretch flex items-center text-xs pl-2 pr-1 text-gray-700 dark:text-white">
          {translate("selection")} (
          {pluralize(translate, "asset", selectedWrappedFeatures.length)})
        </div>
      )}
      <GeometryActions
        selectedWrappedFeatures={selectedWrappedFeatures}
        as="root"
      />
    </div>
  );
}
