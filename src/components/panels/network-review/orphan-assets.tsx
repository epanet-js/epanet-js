import { useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { Button } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { AssetType } from "src/hydraulic-model";
import {
  JunctionIcon,
  PipeIcon,
  PumpIcon,
  ReservoirIcon,
  TankIcon,
  ValveIcon,
} from "src/icons";
import {
  findOrphanAssets,
  OrphanAsset,
} from "src/lib/network-review/orphan-assets";
import { useSelection } from "src/selection";
import { dataAtom, selectionAtom } from "src/state/jotai";

export const OrphanAssets = () => {
  const translate = useTranslate();
  const { orphanAssets, checkOrphanAssets } = useCheckOrphanAssets();
  const selection = useAtomValue(selectionAtom);
  const { selectFeature } = useSelection(selection);
  const zoomTo = useZoomTo();
  const { hydraulicModel } = useAtomValue(dataAtom);
  const [selectedOrphanAssetId, setSelectedOrphanAssetId] = useState<
    string | null
  >(null);

  useEffect(
    function recomputeOrphanAssets() {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      checkOrphanAssets();
    },
    [checkOrphanAssets],
  );

  const selectOrphanAsset = useCallback(
    (orphanAsset: OrphanAsset) => {
      const fullAsset = hydraulicModel.assets.get(orphanAsset.assetId);
      if (!fullAsset) {
        setSelectedOrphanAssetId(null);
        return;
      }
      setSelectedOrphanAssetId(orphanAsset.assetId);
      selectFeature(orphanAsset.assetId);
      zoomTo([fullAsset]);
    },
    [hydraulicModel, selectFeature, zoomTo],
  );

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="py-3 px-4 w-full border-b-2 border-gray-100">
        <p className="text-sm font-bold text-gray-900 dark:text-white">
          {translate("networkReview.orphanNodes.title")}
        </p>
        <p className="text-gray-500 text-sm">
          {translate(
            "networkReview.orphanNodes.summary",
            orphanAssets.length.toString(),
          )}
        </p>
      </div>
      <div className="flex-auto p-1 overflow-y-scroll placemark-scrollbar">
        {orphanAssets.map((orphanAsset) => (
          <OrphanAssetItem
            key={orphanAsset.assetId}
            orphanAsset={orphanAsset}
            isSelected={selectedOrphanAssetId === orphanAsset.assetId}
            onClick={() => selectOrphanAsset(orphanAsset)}
          />
        ))}
      </div>
    </div>
  );
};

const iconByAssetType: { [key in AssetType]: React.ReactNode } = {
  junction: <JunctionIcon />,
  tank: <TankIcon />,
  reservoir: <ReservoirIcon />,
  valve: <ValveIcon />,
  pump: <PumpIcon />,
  pipe: <PipeIcon />,
};

const OrphanAssetItem = ({
  orphanAsset,
  onClick,
  isSelected,
}: {
  orphanAsset: OrphanAsset;
  onClick: () => void;
  isSelected: boolean;
}) => {
  return (
    <Button
      onClick={onClick}
      variant={"quiet"}
      role="button"
      aria-label={"missing"}
      aria-checked={isSelected}
      aria-expanded={isSelected ? "true" : "false"}
      className="group w-full"
    >
      <div
        className="grid gap-x-2 items-start p-1 pr-0 text-sm w-full"
        style={{
          gridTemplateColumns: "auto 1fr",
        }}
      >
        <div className="pt-[.125rem]">{iconByAssetType[orphanAsset.type]}</div>
        <div className="text-sm font-bold text-left">{orphanAsset.assetId}</div>
      </div>
    </Button>
  );
};

const useCheckOrphanAssets = () => {
  const [orphanAssets, setOrphanAssets] = useState<OrphanAsset[]>([]);
  const { hydraulicModel } = useAtomValue(dataAtom);

  const checkOrphanAssets = useCallback(async () => {
    const result = await findOrphanAssets(hydraulicModel);
    setOrphanAssets(result);
  }, [hydraulicModel]);

  return { checkOrphanAssets, orphanAssets };
};
