import { useTranslate } from "src/hooks/use-translate";
import { ConnectivityTraceIcon, OrphanNodeIcon } from "src/icons";

export function NetworkReview() {
  const translate = useTranslate();
  return (
    <div className="flex-auto overflow-y-auto placemark-scrollbar">
      <div className="flex flex-col divide-y divide-gray-200 dark:divide-gray-900 border-gray-200 dark:border-gray-900">
        <div className="px-3 py-5">
          <div className="flex items-start justify-between text-sm font-bold text-gray-900 dark:text-white pb-3">
            {translate("networkReview.title")}
          </div>
          <div className="items-start text-sm">
            {translate("networkReview.description")}
          </div>
        </div>
      </div>
      <div
        className="grid gap-x-2 gap-y-4 items-start p-2 text-sm"
        style={{
          gridTemplateColumns: "min-content 1fr",
        }}
      >
        <div className="pt-[.125rem]">
          <ConnectivityTraceIcon />
        </div>
        <div className="text-sm font-semibold pb-2">
          {translate("networkReview.connectivityTrace.title")}
        </div>
        <div className="pt-[.125rem]">
          <OrphanNodeIcon />
        </div>
        <div className="text-sm font-semibold pb-2">
          {translate("networkReview.orphanNodes.title")}
        </div>
      </div>
    </div>
  );
}
