import { useVirtualizer } from "@tanstack/react-virtual";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { AssetType } from "src/hydraulic-model";
import {
  ChevronLeftIcon,
  CloseIcon,
  JunctionIcon,
  NoIssuesIcon,
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

export const OrphanAssets = ({ onGoBack }: { onGoBack: () => void }) => {
  const translate = useTranslate();
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

  const goBack = useCallback(() => {
    userTracking.capture({
      name: "networkReview.orphanAssets.back",
      count: orphanAssets.length,
    });
    onGoBack();
  }, [onGoBack, userTracking, orphanAssets]);

  return (
    <div className="absolute inset-0 flex flex-col">
      <div
        className="grid gap-x-1 items-start w-full border-b-2 border-gray-100 group pl-1 pt-1"
        style={{
          gridTemplateColumns: "auto 1fr",
        }}
      >
        <Button
          size="xs"
          className="py-3"
          variant={"quiet"}
          role="button"
          aria-label={translate("back")}
          onClick={goBack}
        >
          <ChevronLeftIcon />
        </Button>
        <div className="w-full flex-col py-3 ">
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {translate("networkReview.orphanAssets.title")}
          </p>
          <IssuesSummary count={orphanAssets.length} />
        </div>
      </div>
      <ToolDescription />
      {orphanAssets.length > 0 ? (
        <IssuesList
          issues={orphanAssets}
          onClick={selectOrphanAsset}
          selectedId={selectedOrphanAssetId}
        />
      ) : (
        <EmptyState />
      )}
    </div>
  );
};

const IssuesSummary = ({ count }: { count: number }) => {
  const translate = useTranslate();

  const message =
    count > 0
      ? translate(
          "networkReview.orphanAssets.summary.issuesFound",
          count.toString(),
        )
      : translate("networkReview.orphanAssets.summary.noIssuesFound");

  return <p className="text-gray-500 text-sm">{message}</p>;
};

const ToolDescription = () => {
  const translate = useTranslate();
  const [isShown, setIsShown] = useState(true);
  return isShown ? (
    <div className="w-full p-2">
      <div
        className="w-full bg-blue-50 rounded p-4 relative shadow-sm"
        role="status"
        aria-live="polite"
      >
        <Button
          variant="quiet"
          aria-label="Dismiss info"
          className="absolute right-1 top-1"
          onClick={() => setIsShown(false)}
        >
          <CloseIcon size="sm" />
        </Button>
        <div className="flex items-start gap-3">
          <p className="text-sm">
            {translate("networkReview.orphanAssets.description")}
          </p>
        </div>
      </div>
    </div>
  ) : null;
};

const EmptyState = () => {
  const translate = useTranslate();
  return (
    <div className="flex-grow flex flex-col items-center justify-center p-4">
      <div className="text-gray-200">
        <NoIssuesIcon size={96} strokeWidth={1.75} />
      </div>
      <p className="text-center pt-4 font-bold text-gray-300">
        {translate("networkReview.orphanAssets.noIssues")}
      </p>
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
  const parentRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: issues.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
  });

  useEffect(() => {
    if (selectedId === null) return;

    const rowIndex = issues.findIndex(
      (orphanAsset) => orphanAsset.assetId === selectedId,
    );

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

  return (
    <div
      ref={parentRef}
      className="flex-auto p-1 overflow-y-auto placemark-scrollbar"
      tabIndex={0}
    >
      <div
        className="w-full relative"
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const issue = issues[virtualRow.index];
          return (
            <div
              key={issue.assetId}
              className="w-full top-0 left-0 block absolute p-0"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
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
