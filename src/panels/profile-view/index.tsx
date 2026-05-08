"use client";
import { memo, useMemo } from "react";
import { useAtom } from "jotai";
import { useTranslate } from "src/hooks/use-translate";
import { Button } from "src/components/elements";
import { AddIcon, SelectPathIcon } from "src/icons";
import { useStartProfileSelection } from "src/commands/start-profile-selection";
import { selectionAtom } from "src/state/selection";
import { useProfileViewData, ProfileViewData } from "./chart-data";
import { ChartContainer } from "./chart-container";

export const ProfileViewPanel = memo(function ProfileViewPanel() {
  const data = useProfileViewData();

  const showChart = data.phase === "showingProfile" && data.points.length > 0;

  return (
    <div className="absolute inset-0 flex flex-col bg-white dark:bg-gray-800">
      {showChart && <ProfileActionRow data={data} />}
      <div className="flex-1 min-h-0">
        {showChart ? (
          <ChartContainer data={data} />
        ) : (
          <ProfileEmptyState phase={data.phase} />
        )}
      </div>
    </div>
  );
});

const ProfileActionRow = ({ data }: { data: ProfileViewData }) => {
  const translate = useTranslate();
  const startSelection = useStartProfileSelection();
  const [selection, setSelection] = useAtom(selectionAtom);

  const pathIds = useMemo(
    () => [
      ...data.points.map((p) => p.nodeId),
      ...data.links.map((l) => l.linkId),
    ],
    [data.points, data.links],
  );

  const isAllPathSelected = useMemo(() => {
    if (selection.type !== "multi") return false;
    if (selection.ids.length !== pathIds.length) return false;
    const selected = new Set(selection.ids);
    return pathIds.every((id) => selected.has(id));
  }, [selection, pathIds]);

  return (
    <div className="flex items-center gap-2 pl-3 pr-5 py-2 border-b border-gray-100 dark:border-gray-700">
      <Button
        variant="default"
        size="xs"
        onClick={() => startSelection({ source: "panel" })}
      >
        <AddIcon size="sm" />
        {translate("profileView.new")}
      </Button>
      <Button
        variant="default"
        size="xs"
        disabled={isAllPathSelected}
        onClick={() => setSelection({ type: "multi", ids: pathIds })}
      >
        <SelectPathIcon size="sm" />
        {translate("profileView.selectAll")}
      </Button>
    </div>
  );
};

const ProfileEmptyState = ({ phase }: { phase: ProfileViewData["phase"] }) => {
  const translate = useTranslate();
  const startSelection = useStartProfileSelection();

  if (phase === "idle") {
    return (
      <div className="h-full flex items-center justify-center px-4">
        <Button
          variant="default"
          size="xs"
          onClick={() => startSelection({ source: "panel" })}
        >
          <AddIcon size="sm" />
          {translate("profileView.createProfile")}
        </Button>
      </div>
    );
  }

  const message =
    phase === "selectingStart"
      ? translate("profileView.empty.selectingStart")
      : phase === "selectingEnd"
        ? translate("profileView.empty.selectingEnd")
        : translate("profileView.empty.noData");

  return (
    <div className="h-full flex items-center justify-center text-gray-400 text-xs px-4 text-center">
      {message}
    </div>
  );
};
