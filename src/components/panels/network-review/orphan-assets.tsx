import { useVirtualizer } from "@tanstack/react-virtual";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { useUserTracking } from "src/infra/user-tracking";
import {
  findOrphanAssets,
  OrphanAsset,
} from "src/lib/network-review/orphan-assets";
import { useSelection } from "src/selection";
import { dataAtom, selectionAtom } from "src/state/jotai";
import { CheckType, EmptyState, ToolDescription, ToolHeader } from "./common";

export const OrphanAssets = ({ onGoBack }: { onGoBack: () => void }) => {
  const userTracking = useUserTracking();
  const { orphanAssets, checkOrphanAssets } = useCheckOrphanAssets();
  const selection = useAtomValue(selectionAtom);
  const { selectFeature, isSelected } = useSelection(selection);
  const zoomTo = useZoomTo();
  const { hydraulicModel } = useAtomValue(dataAtom);
  const [selectedOrphanAssetId, setSelectedOrphanAssetId] = useState<
    string | null
  >(null);

  const lastIssuesCount = useRef(0);

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

  useEffect(() => {
    const selectedOrphanAsset = orphanAssets.find((orphanAsset) =>
      isSelected(orphanAsset.assetId),
    );

    if (!selectedOrphanAsset) {
      setSelectedOrphanAssetId(null);
    } else
      setSelectedOrphanAssetId((prev) =>
        prev === selectedOrphanAsset.assetId
          ? prev
          : selectedOrphanAsset.assetId,
      );
  }, [orphanAssets, isSelected, setSelectedOrphanAssetId]);

  useEffect(() => {
    const issuesCount = orphanAssets.length;
    if (lastIssuesCount.current !== issuesCount) {
      lastIssuesCount.current = issuesCount;
      userTracking.capture({
        name: "networkReview.orphanAssets.changed",
        count: issuesCount,
      });
    }
  }, [orphanAssets, userTracking]);

  return (
    <div className="absolute inset-0 flex flex-col">
      <ToolHeader
        checkType={CheckType.orphanAssets}
        onGoBack={onGoBack}
        itemsCount={orphanAssets.length}
      />
      {orphanAssets.length > 0 ? (
        <IssuesList
          issues={orphanAssets}
          onClick={selectOrphanAsset}
          selectedId={selectedOrphanAssetId}
        />
      ) : (
        <EmptyState checkType={CheckType.orphanAssets} />
      )}
    </div>
  );
};

const IssuesList = ({
  issues,
  onClick,
  selectedId,
}: {
  issues: OrphanAsset[];
  onClick: (issue: OrphanAsset) => void;
  selectedId: string | null;
}) => {
  const headerRows = 1;
  const parentRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: issues.length + headerRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
  });

  useEffect(() => {
    if (selectedId === null) return;

    const rowIndex =
      issues.findIndex((orphanAsset) => orphanAsset.assetId === selectedId) +
      headerRows;

    const range = rowVirtualizer.range;

    if (!range) return;
    const { startIndex, endIndex } = range;
    if (rowIndex >= startIndex && rowIndex < endIndex) {
      return;
    }

    rowVirtualizer.scrollToIndex(rowIndex, {
      align: "center",
    });
  }, [selectedId, issues, rowVirtualizer]);

  const items = rowVirtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="flex-auto p-1 overflow-y-auto placemark-scrollbar"
      style={{ contain: "strict" }}
      tabIndex={0}
    >
      <div
        className="w-full relative"
        style={{ height: rowVirtualizer.getTotalSize() }}
      >
        <div
          className="absolute top-0 left-0 w-full"
          style={{
            transform: `translateY(${items[0]?.start ?? 0}px)`,
          }}
        >
          {items.map((virtualRow) => {
            if (virtualRow.index === 0) {
              return (
                <div
                  key="description"
                  data-index={virtualRow.index}
                  className="w-full"
                  ref={rowVirtualizer.measureElement}
                  role="listItem"
                >
                  <ToolDescription checkType={CheckType.orphanAssets} />
                </div>
              );
            }

            const issue = issues[virtualRow.index + headerRows];
            return (
              <div
                key={issue.assetId}
                data-index={virtualRow.index}
                className="w-full"
                ref={rowVirtualizer.measureElement}
                role="listItem"
              >
                <OrphanAssetItem
                  orphanAsset={issue}
                  selectedId={selectedId}
                  onClick={onClick}
                />
              </div>
            );
          })}
        </div>
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
  selectedId,
}: {
  orphanAsset: OrphanAsset;
  onClick: (orphanAsset: OrphanAsset) => void;
  selectedId: string | null;
}) => {
  const translate = useTranslate();
  const isSelected = selectedId === orphanAsset.assetId;

  return (
    <Button
      onClick={() => onClick(orphanAsset)}
      variant={"quiet"}
      role="button"
      aria-label={translate(
        "networkReview.orphanAssets.issueLabel",
        translate(orphanAsset.type),
        orphanAsset.label,
      )}
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
        <div className="text-sm font-semibold text-left">
          {orphanAsset.label}
        </div>
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
