"use client";
import { memo } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { useProfileViewData, ProfileViewData } from "./data";
import { ProfileChart } from "./profile-chart";

export const ProfileViewPanel = memo(function ProfileViewPanel() {
  const data = useProfileViewData();

  const showChart = data.phase === "showingProfile" && data.points.length > 0;

  return (
    <div className="absolute inset-0 flex flex-col bg-white dark:bg-gray-800">
      <div className="flex-1 min-h-0">
        {showChart ? (
          <ProfileChart data={data} />
        ) : (
          <ProfileEmptyState phase={data.phase} />
        )}
      </div>
    </div>
  );
});

const ProfileEmptyState = ({ phase }: { phase: ProfileViewData["phase"] }) => {
  const translate = useTranslate();
  const message = (() => {
    switch (phase) {
      case "selectingStart":
        return translate("profileView.empty.selectingStart");
      case "selectingEnd":
        return translate("profileView.empty.selectingEnd");
      case "showingProfile":
        return translate("profileView.empty.noData");
      case "idle":
      default:
        return translate("profileView.empty.idle");
    }
  })();

  return (
    <div className="h-full flex items-center justify-center text-gray-400 text-xs px-4 text-center">
      {message}
    </div>
  );
};
