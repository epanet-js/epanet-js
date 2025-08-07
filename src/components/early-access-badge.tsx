import { StarIcon } from "@radix-ui/react-icons";
import { useTranslate } from "src/hooks/use-translate";

export function EarlyAccessBadge() {
  const translate = useTranslate();

  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold uppercase text-white bg-gradient-to-r from-teal-500 to-teal-400 rounded-full shadow-sm">
      <StarIcon className="w-3 h-3" />
      {translate("earlyAccess")}
    </div>
  );
}
