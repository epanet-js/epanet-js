import { Suspense } from "react";
import { LayersIcon } from "@radix-ui/react-icons";
import * as T from "@radix-ui/react-tooltip";
import * as E from "src/components/elements";
import { Root, Trigger } from "@radix-ui/react-popover";
import { LayersPopover } from "./layers/popover";
import { translate } from "src/infra/i18n";
import { useUserTracking } from "src/infra/user-tracking";

export const Visual = () => {
  const userTracking = useUserTracking();

  return (
    <div className="flex items-center">
      <T.Root>
        <Root>
          <div className="p-2 flex items-stretch">
            <T.Trigger asChild>
              <Trigger aria-label="Layers" asChild>
                <E.Button
                  variant="quiet"
                  onClick={() => {
                    userTracking.capture({
                      name: "layersPopover.opened",
                      source: "toolbar",
                    });
                  }}
                >
                  <LayersIcon />
                  {translate("layers")}
                </E.Button>
              </Trigger>
            </T.Trigger>
          </div>
          <E.PopoverContent2 size="md">
            <Suspense fallback={<E.Loading size="sm" />}>
              <LayersPopover />
            </Suspense>
          </E.PopoverContent2>
        </Root>
        <E.TContent side="bottom">
          <span className="whitespace-nowrap">Manage background layers</span>
        </E.TContent>
      </T.Root>
    </div>
  );
};
