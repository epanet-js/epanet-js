import { Suspense, useState } from "react";
import { LayersIcon } from "@radix-ui/react-icons";
import * as E from "src/components/elements";
import { Root, Trigger } from "@radix-ui/react-popover";
import { LayersPopover } from "./layers/popover";
import { translate } from "src/infra/i18n";
import { useUserTracking } from "src/infra/user-tracking";

export const Visual = () => {
  const userTracking = useUserTracking();
  const [isOpen, setOpen] = useState<boolean>(false);

  return (
    <div className="flex items-center">
      <Root
        open={isOpen}
        onOpenChange={(val) => {
          setOpen(val);
        }}
      >
        <div className="p-2 flex items-stretch">
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
        </div>
        <E.PopoverContent2 size="md">
          <Suspense fallback={<E.Loading size="sm" />}>
            <LayersPopover onClose={() => setOpen(false)} />
          </Suspense>
        </E.PopoverContent2>
      </Root>
    </div>
  );
};
