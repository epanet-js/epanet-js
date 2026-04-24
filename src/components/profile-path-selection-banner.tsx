"use client";
import { memo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { profileViewAtom } from "src/state/profile-view";
import { modeAtom, Mode } from "src/state/mode";
import { ephemeralStateAtom } from "src/state/drawing";
import { useTranslate } from "src/hooks/use-translate";

export const ProfilePathSelectionBanner = memo(
  function ProfilePathSelectionBanner() {
    const profileView = useAtomValue(profileViewAtom);
    const setProfileView = useSetAtom(profileViewAtom);
    const setMode = useSetAtom(modeAtom);
    const setEphemeralState = useSetAtom(ephemeralStateAtom);
    const translate = useTranslate();

    const phase = profileView.phase;

    if (phase !== "selectingStart" && phase !== "selectingEnd") {
      return null;
    }

    const message =
      phase === "selectingStart"
        ? translate("profileView.selectStart")
        : translate("profileView.selectEnd");

    const handleCancel = () => {
      setProfileView({ phase: "idle" });
      setEphemeralState({ type: "none" });
      setMode({ mode: Mode.NONE });
    };

    return (
      <div
        className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3
          bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
          rounded shadow-md px-4 py-2 text-sm pointer-events-none"
        style={{ maxWidth: "90%" }}
      >
        <span className="text-gray-700 dark:text-gray-300">{message}</span>
        <button
          onClick={handleCancel}
          className="pointer-events-auto text-xs text-gray-500 hover:text-gray-800
            dark:hover:text-gray-100 underline focus:outline-none"
        >
          {translate("profileView.cancelSelection")}
        </button>
      </div>
    );
  },
);
