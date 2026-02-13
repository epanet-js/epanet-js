import * as Tooltip from "@radix-ui/react-tooltip";
import { Button, TContent, StyledTooltipArrow } from "src/components/elements";
import { PointerClickIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import { Asset, AssetId } from "src/hydraulic-model";
import { useSelection } from "src/selection/use-selection";
import { useAtomValue } from "jotai";
import { selectionAtom } from "src/state/jotai";
import { useUserTracking } from "src/infra/user-tracking";
import { pluralize } from "src/lib/utils";

export function SelectOnlyButton({
  assetType,
  assetIds,
}: {
  assetType: Asset["type"];
  assetIds: AssetId[];
}) {
  const translate = useTranslate();
  const selection = useAtomValue(selectionAtom);
  const { selectAssets } = useSelection(selection);
  const userTracking = useUserTracking();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    userTracking.capture({
      name: "selection.narrowedToType",
      type: assetType,
      count: assetIds.length,
    });
    selectAssets(assetIds);
  };

  return (
    <Tooltip.Root>
      <Tooltip.Trigger onClick={handleClick} asChild>
        <Button
          variant="quiet"
          className="w-full h-full justify-center"
          size="xxs"
        >
          <PointerClickIcon size="lg" />
        </Button>
      </Tooltip.Trigger>
      <TContent side="bottom">
        <StyledTooltipArrow />
        <span className="whitespace-nowrap">
          {`${translate("select")} ${pluralize(
            translate,
            assetType,
            assetIds.length,
            false,
          )}`}
        </span>
      </TContent>
    </Tooltip.Root>
  );
}
