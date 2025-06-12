import { CaretDownIcon } from "@radix-ui/react-icons";
import * as E from "src/components/elements";
import * as DD from "@radix-ui/react-dropdown-menu";
import { useAtomValue } from "jotai";
import { selectedFeaturesAtom } from "src/state/jotai";
import * as T from "@radix-ui/react-tooltip";
import React from "react";
import { GeometryActions } from "./context_actions/geometry_actions";
import { pluralize } from "src/lib/utils";
import { translate } from "src/infra/i18n";

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
            <CaretDownIcon className="w-3 h-3" />
          </E.Button>
        </DD.Trigger>
      </T.Trigger>
    </div>
  );
}

export default function ContextActions() {
  const selectedWrappedFeatures = useAtomValue(selectedFeaturesAtom);

  if (selectedWrappedFeatures.length === 0) return null;

  return (
    <div className="flex items-center">
      <div className="h-12 self-stretch flex items-center text-xs pl-2 pr-1 text-gray-700 dark:text-white">
        {translate("selection")} (
        {pluralize("asset", selectedWrappedFeatures.length)})
      </div>
      <GeometryActions
        selectedWrappedFeatures={selectedWrappedFeatures}
        as="root"
      />
    </div>
  );
}
