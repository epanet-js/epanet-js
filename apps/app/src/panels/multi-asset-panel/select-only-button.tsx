import { Tooltip } from "@epanet-js/ui-kit";
import { Button } from "src/components/elements";
import { PointerClickIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import { Asset, AssetId } from "src/hydraulic-model";
import { useSelection } from "src/selection";
import { useAtomValue } from "jotai";
import { selectionAtom } from "src/state/selection";
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
      name: "selection.narrowedToAssetType",
      type: assetType,
      count: assetIds.length,
    });
    selectAssets(assetIds);
  };

  return (
    <Tooltip
      delayDuration={700}
      content={
        <span className="whitespace-nowrap">
          {`${translate("select")} ${pluralize(
            translate,
            assetType,
            assetIds.length,
            false,
          )}`}
        </span>
      }
    >
      <Button
        variant="quiet"
        className="h-8 w-8 justify-center"
        size="xxs"
        onClick={handleClick}
      >
        <PointerClickIcon />
      </Button>
    </Tooltip>
  );
}

export function SelectOnlyCustomerPointsButton({
  customerPointIds,
}: {
  customerPointIds: number[];
}) {
  const translate = useTranslate();
  const selection = useAtomValue(selectionAtom);
  const { selectCustomerPoints } = useSelection(selection);
  const userTracking = useUserTracking();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    userTracking.capture({
      name: "selection.narrowedToAssetType",
      type: "customerPoint",
      count: customerPointIds.length,
    });
    selectCustomerPoints(customerPointIds);
  };

  return (
    <Tooltip
      delayDuration={700}
      content={
        <span className="whitespace-nowrap">
          {`${translate("select")} ${pluralize(
            translate,
            "customerPoint",
            customerPointIds.length,
            false,
          )}`}
        </span>
      }
    >
      <Button
        variant="quiet"
        className="h-8 w-8 justify-center"
        size="xxs"
        onClick={handleClick}
      >
        <PointerClickIcon />
      </Button>
    </Tooltip>
  );
}
