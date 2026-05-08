"use client";
import { memo } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { Button } from "src/components/elements";
import { useStartProfileSelection } from "src/commands/start-profile-selection";
import { useProfileViewData, ProfileViewData } from "./chart-data";
import { ChartContainer } from "./chart-container";

export const ProfileViewPanel = memo(function ProfileViewPanel() {
  const data = useProfileViewData();

  const showChart = data.phase === "showingProfile" && data.points.length > 0;

  return (
    <div className="absolute inset-0 flex flex-col bg-white dark:bg-gray-800">
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

const ProfileEmptyState = ({ phase }: { phase: ProfileViewData["phase"] }) => {
  const translate = useTranslate();
  const startSelection = useStartProfileSelection();

  if (phase === "idle") {
    return (
      <div className="h-full flex items-center justify-center px-4">
        <Button
          variant="primary"
          onClick={() => startSelection({ source: "panel" })}
        >
          {translate("profileView.selectPath")}
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
