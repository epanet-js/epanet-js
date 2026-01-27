import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { useUserTracking } from "src/infra/user-tracking";
import {
  findConnectivityTrace,
  SubNetwork,
} from "src/lib/network-review/connectivity-trace";
import { USelection, useSelection } from "src/selection";
import { selectionAtom, stagingModelAtom } from "src/state/jotai";
import {
  CheckType,
  EmptyState,
  LoadingState,
  ToolDescription,
  ToolHeader,
  useLoadingStatus,
  VirtualizedIssuesList,
} from "./common";
import { Maybe } from "purify-ts/Maybe";

export const ConnectivityTrace = ({ onGoBack }: { onGoBack: () => void }) => {
  const userTracking = useUserTracking();
  const { subnetworks, checkConnectivityTrace, isLoading, isReady } =
    useCheckConnectivityTrace();
  const selection = useAtomValue(selectionAtom);
  const { clearSelection, setSelection, getSelectionIds } =
    useSelection(selection);
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
    (subnetwork: SubNetwork | null) => {
      if (!subnetwork) {
        setSelectedSubnetworkId(null);
        clearSelection();
        return;
      }

      setSelectedSubnetworkId(subnetwork.subnetworkId);

      const allIds = [...subnetwork.nodeIds, ...subnetwork.linkIds];
      setSelection(USelection.fromIds(allIds));

      if (subnetwork.bounds) {
        zoomTo(Maybe.of(subnetwork.bounds));
      }
    },
    [clearSelection, setSelection, zoomTo],
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

  useEffect(() => {
    const selectedIds = getSelectionIds();
    if (selectedIds.length === 0) setSelectedSubnetworkId(null);
    const firstSelectedId = selectedIds[0];

    const candidateSubNetwork = subnetworks.find(
      (subNetwork) =>
        subNetwork.linkIds.findIndex((linkId) => linkId === firstSelectedId) >=
          0 ||
        subNetwork.nodeIds.findIndex((nodeId) => nodeId === firstSelectedId) >=
          0,
    );

    if (!candidateSubNetwork) {
      setSelectedSubnetworkId(null);
    } else {
      const subNetworkId = candidateSubNetwork.subnetworkId;
      setSelectedSubnetworkId((prev) =>
        prev === subNetworkId ? prev : subNetworkId,
      );
    }
  }, [subnetworks, getSelectionIds]);

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
              <SubNetworksList
                subNetworks={subnetworks}
                onClick={selectSubnetwork}
                selectedSubNetwork={selectedSubnetworkId}
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

const SubNetworksList = ({
  subNetworks,
  onClick,
  selectedSubNetwork,
  onGoBack,
}: {
  subNetworks: SubNetwork[];
  onClick: (issue: SubNetwork | null) => void;
  selectedSubNetwork: number | null;
  onGoBack: () => void;
}) => {
  return (
    <VirtualizedIssuesList
      items={subNetworks}
      selectedItemId={selectedSubNetwork}
      onSelect={onClick}
      getItemId={(issue) => issue.subnetworkId}
      renderItem={(index, subnetwork, selectedId, onClick) => (
        <SubnetworkItem
          index={index}
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
  index,
  subnetwork,
  onClick,
  selectedId,
}: {
  index: number;
  subnetwork: SubNetwork;
  onClick: (subnetwork: SubNetwork) => void;
  selectedId: number | null;
}) => {
  const translate = useTranslate();
  const isSelected = selectedId === subnetwork.subnetworkId;

  const supplySourceText = translate(
    "networkReview.connectivityTrace.supplySourceCount",
    subnetwork.supplySourceCount,
  );
  const pipesText = translate(
    "networkReview.connectivityTrace.pipesCount",
    subnetwork.pipeCount,
  );

  return (
    <Button
      onClick={() => onClick(subnetwork)}
      onMouseDown={(e) => e.preventDefault()}
      variant={"quiet/list"}
      role="button"
      aria-label={translate(
        "networkReview.connectivityTrace.issueLabel",
        String(index),
        String(subnetwork.supplySourceCount),
        String(subnetwork.linkIds.length),
      )}
      aria-checked={isSelected}
      aria-expanded={isSelected ? "true" : "false"}
      aria-selected={isSelected}
      tabIndex={-1}
      className="group w-full"
    >
      <div className="flex flex-col items-start p-1 pr-0 text-sm w-full text-left">
        <div className="truncate">
          {translate(
            "networkReview.connectivityTrace.subnetwork",
            String(index),
          )}
        </div>
        <div className="text-gray-500 truncate">
          {supplySourceText} · {pipesText}
        </div>
      </div>
    </Button>
  );
};

const deferToAllowRender = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

const useCheckConnectivityTrace = () => {
  const [subnetworks, setSubnetworks] = useState<SubNetwork[]>([]);
  const hydraulicModel = useAtomValue(stagingModelAtom);
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
