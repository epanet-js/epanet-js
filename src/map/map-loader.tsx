import { ReloadIcon } from "@radix-ui/react-icons";
import { useAtomValue } from "jotai";
import { mapLoadingAtom } from "./state";
import { useRef } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { RefreshIcon } from "src/icons";

export const MapLoading = () => {
  const translate = useTranslate();
  const mapLoading = useAtomValue(mapLoadingAtom);
  const ref = useRef();
  const useLucideIcons = useFeatureFlag("FLAG_LUCIDE_ICONS");

  const opacityClass = mapLoading ? "opacity-100" : "opacity-0";
  const isHidden = !mapLoading;
  return (
    <div className="absolute right-3 top-3 mx-auto mb-2">
      <div
        key={ref.current}
        aria-hidden={isHidden}
        className={`flex items-center gap-x-2 bg-black bg-opacity-30 text-white
            px-3 py-1
            rounded
            font-semibold
            text-sm
            select-none
            transition-opacity
            duration-1000
            ${opacityClass}
            pointer-events-none`}
      >
        {useLucideIcons ? (
          <RefreshIcon className="animate-spin" />
        ) : (
          <ReloadIcon className="animate-spin" />
        )}
        {translate("loading")}
      </div>
    </div>
  );
};
