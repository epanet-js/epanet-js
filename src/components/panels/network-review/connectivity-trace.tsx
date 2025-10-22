import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { useUserTracking } from "src/infra/user-tracking";
import {
  findConnectivityTrace,
  Subnetwork,
} from "src/lib/network-review/connectivity-trace";
import { useSelection } from "src/selection";
import { dataAtom, selectionAtom } from "src/state/jotai";
import {
  CheckType,
  EmptyState,
  LoadingState,
  ToolDescription,
  ToolHeader,
  useLoadingStatus,
  VirtualizedIssuesList,
} from "./common";
import { CheckCircleIcon, AlertTriangleIcon } from "lucide-react";
import { Maybe } from "purify-ts/Maybe";

export const ConnectivityTrace = ({ onGoBack }: { onGoBack: () => void }) => {
  const userTracking = useUserTracking();
  const { subnetworks, checkConnectivityTrace, isLoading, isReady } =
    useCheckConnectivityTrace();
  const selection = useAtomValue(selectionAtom);
  const { clearSelection } = useSelection(selection);
  const zoomTo = useZoomTo();
  const [selectedSubnetworkId, setSelectedSubnetworkId] = useState<
    number | null
  >(null);

  const lastIssuesCount = useRef(0);

  useEffect(
    function recomputeConnectivityTrace() {
      void checkConnectivityTrace();
    },
    [checkConnectivityTrace],
  );

  const selectSubnetwork = useCallback(
    (subnetwork: Subnetwork | null) => {
      if (!subnetwork) {
        setSelectedSubnetworkId(null);
        clearSelection();
        return;
      }

      setSelectedSubnetworkId(subnetwork.subnetworkId);

      if (subnetwork.bounds) {
        zoomTo(Maybe.of(subnetwork.bounds));
      }
    },
    [clearSelection, zoomTo],
  );

  useEffect(() => {
    const issuesCount = subnetworks.length;
    if (lastIssuesCount.current !== issuesCount) {
      lastIssuesCount.current = issuesCount;
      userTracking.capture({
        name: "networkReview.connectivityTrace.changed",
        count: issuesCount,
      });
    }
  }, [subnetworks, userTracking]);

  return (
    <div className="absolute inset-0 flex flex-col">
      <ToolHeader
        checkType={CheckType.connectivityTrace}
        onGoBack={onGoBack}
        itemsCount={subnetworks.length}
        autoFocus={subnetworks.length === 0 && !isLoading}
      />
      <div className="relative flex-grow flex flex-col">
        {isReady ? (
          <>
            {subnetworks.length > 0 ? (
              <IssuesList
                issues={subnetworks}
                onClick={selectSubnetwork}
                selectedId={selectedSubnetworkId}
                onGoBack={onGoBack}
              />
            ) : (
              <>
                <ToolDescription checkType={CheckType.connectivityTrace} />
                <EmptyState checkType={CheckType.connectivityTrace} />
              </>
            )}
            {isLoading && <LoadingState overlay />}
          </>
        ) : (
          <>
            <ToolDescription checkType={CheckType.connectivityTrace} />
            <LoadingState />
          </>
        )}
      </div>
    </div>
  );
};

const IssuesList = ({
  issues,
  onClick,
  selectedId,
  onGoBack,
}: {
  issues: Subnetwork[];
  onClick: (issue: Subnetwork | null) => void;
  selectedId: number | null;
  onGoBack: () => void;
}) => {
  return (
    <VirtualizedIssuesList
      items={issues}
      selectedId={selectedId !== null ? String(selectedId) : null}
      onSelect={onClick}
      getItemId={(issue) => String(issue.subnetworkId)}
      renderItem={(subnetwork, selectedId, onClick) => (
        <SubnetworkItem
          subnetwork={subnetwork}
          selectedId={selectedId}
          onClick={onClick}
        />
      )}
      checkType={CheckType.connectivityTrace}
      onGoBack={onGoBack}
    />
  );
};

const SubnetworkItem = ({
  subnetwork,
  onClick,
  selectedId,
}: {
  subnetwork: Subnetwork;
  onClick: (subnetwork: Subnetwork) => void;
  selectedId: string | null;
}) => {
  const translate = useTranslate();
  const isSelected = selectedId === String(subnetwork.subnetworkId);

  const supplySourceLabel = subnetwork.hasSupplySource
    ? translate(
        "networkReview.connectivityTrace.supplySourceTypes",
        subnetwork.supplySourceTypes.join(", "),
      )
    : translate("networkReview.connectivityTrace.noSupplySource");

  return (
    <Button
      onClick={() => onClick(subnetwork)}
      onMouseDown={(e) => e.preventDefault()}
      variant={"quiet/list"}
      role="button"
      aria-label={translate(
        "networkReview.connectivityTrace.issueLabel",
        String(subnetwork.subnetworkId + 1),
        String(subnetwork.nodeIds.length),
        String(subnetwork.linkIds.length),
      )}
      aria-checked={isSelected}
      aria-expanded={isSelected ? "true" : "false"}
      aria-selected={isSelected}
      tabIndex={-1}
      className="group w-full"
    >
      <div className="grid grid-cols-[auto_1fr_auto] gap-x-2 items-start p-1 pr-0 text-sm w-full">
        <div
          className="w-4 h-4 rounded-full mt-1"
          style={{ backgroundColor: subnetwork.color }}
        />

        <div className="text-left min-w-0">
          <div className="font-medium">
            {translate(
              "networkReview.connectivityTrace.subnetwork",
              String(subnetwork.subnetworkId + 1),
            )}
          </div>
          <div className="text-sm text-gray-500">
            {translate(
              "networkReview.connectivityTrace.stats",
              String(subnetwork.nodeIds.length),
              String(subnetwork.linkIds.length),
            )}
          </div>
          <div
            className={`text-sm ${
              subnetwork.hasSupplySource ? "text-green-600" : "text-orange-600"
            }`}
          >
            {supplySourceLabel}
          </div>
        </div>

        <div
          className={`pt-[.125rem] ${
            subnetwork.hasSupplySource ? "text-green-600" : "text-orange-600"
          }`}
        >
          {subnetwork.hasSupplySource ? (
            <CheckCircleIcon size={20} />
          ) : (
            <AlertTriangleIcon size={20} />
          )}
        </div>
      </div>
    </Button>
  );
};

const deferToAllowRender = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

const useCheckConnectivityTrace = () => {
  const [subnetworks, setSubnetworks] = useState<Subnetwork[]>([]);
  const { hydraulicModel } = useAtomValue(dataAtom);
  const { startLoading, finishLoading, isLoading } = useLoadingStatus();
  const isReady = useRef(false);

  const checkConnectivityTrace = useCallback(async () => {
    startLoading();
    await deferToAllowRender();
    const result = await findConnectivityTrace(hydraulicModel);
    setSubnetworks(result);
    finishLoading();
    isReady.current = true;
  }, [hydraulicModel, startLoading, finishLoading]);

  return {
    checkConnectivityTrace,
    subnetworks,
    isLoading,
    isReady: isReady.current,
  };
};
