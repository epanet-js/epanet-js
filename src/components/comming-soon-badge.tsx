import { useTranslate } from "src/hooks/use-translate";

export function CommingSoonBadge() {
  const translate = useTranslate();

  return (
    <div className="inline-flex items-center gap-1 px-1 text-[0.6rem] font-semibold uppercase text-white border-teal-700 border rounded-full shadow-sm text-teal-700 whitespace-nowrap">
      {translate("comingSoon")}
    </div>
  );
}
