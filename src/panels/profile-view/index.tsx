"use client";
import { memo } from "react";
import { useAtomValue } from "jotai";
import { profileViewAtom, ProfileViewState } from "src/state/profile-view";
import { useTranslate } from "src/hooks/use-translate";
import { useProfileData, useProfileLinks } from "./use-profile-data";
import { useProfileHglRange } from "./use-profile-hgl-range";
import { ProfileChart } from "./profile-chart";

export const ProfileViewPanel = memo(function ProfileViewPanel() {
  const profileView = useAtomValue(profileViewAtom);
  const points = useProfileData();
  const links = useProfileLinks();
  const { ranges: hglRanges } = useProfileHglRange();

  const showChart =
    profileView.phase === "showingProfile" && points && points.length > 0;

  return (
    <div className="absolute inset-0 flex flex-col bg-white dark:bg-gray-800">
      <div className="flex-1 min-h-0">
        {showChart ? (
          <ProfileChart points={points} links={links} hglRanges={hglRanges} />
        ) : (
          <ProfileEmptyState phase={profileView.phase} />
        )}
      </div>
    </div>
  );
});

const ProfileEmptyState = ({ phase }: { phase: ProfileViewState["phase"] }) => {
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
