import { useTranslate } from "src/hooks/use-translate";
import { EarlyAccessIcon } from "src/icons";

export function EarlyAccessBadge() {
  const translate = useTranslate();

  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold uppercase text-white bg-gradient-to-r from-teal-500 to-teal-400 rounded-full shadow-sm">
      <EarlyAccessIcon size="sm" />
      {translate("earlyAccess")}
    </div>
  );
}
