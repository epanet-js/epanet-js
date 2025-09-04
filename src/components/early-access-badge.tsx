import { StarIcon } from "@radix-ui/react-icons";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { EarlyAccessIcon } from "src/icons";

export function EarlyAccessBadge() {
  const translate = useTranslate();
  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");

  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold uppercase text-white bg-gradient-to-r from-teal-500 to-teal-400 rounded-full shadow-sm">
      {isLucideIconsOn ? (
        <EarlyAccessIcon size="sm" />
      ) : (
        <StarIcon className="w-3 h-3" />
      )}
      {translate("earlyAccess")}
    </div>
  );
}
