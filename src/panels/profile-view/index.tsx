"use client";
import { memo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { profileViewAtom } from "src/state/profile-view";
import { modeAtom, Mode } from "src/state/mode";
import { ephemeralStateAtom } from "src/state/drawing";
import { useTranslate } from "src/hooks/use-translate";
import { useProfileData } from "./use-profile-data";
import { ProfileChart } from "./profile-chart";

export const ProfileViewPanel = memo(function ProfileViewPanel() {
  const profileView = useAtomValue(profileViewAtom);
  const setProfileView = useSetAtom(profileViewAtom);
  const setMode = useSetAtom(modeAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const translate = useTranslate();
  const points = useProfileData();

  if (profileView.phase !== "showingProfile") return null;

  const handleClose = () => {
    setProfileView({ phase: "idle" });
    setEphemeralState({ type: "none" });
    setMode({ mode: Mode.NONE });
  };

  return (
    <div className="flex-1 min-h-0 border-t border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-800 flex flex-col">
      <div className="flex items-center justify-between px-3 py-1 border-b border-gray-100 dark:border-gray-900 flex-none">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {translate("profileView.toolbar")}
        </span>
        <button
          onClick={handleClose}
          className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none"
          aria-label={translate("profileView.close")}
        >
          ✕
        </button>
      </div>
      <div className="flex-1 min-h-0 p-1">
        {points && points.length > 0 ? (
          <ProfileChart points={points} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400 text-xs">
            No data
          </div>
        )}
      </div>
    </div>
  );
});
