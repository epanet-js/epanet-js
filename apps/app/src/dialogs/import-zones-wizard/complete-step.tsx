import { useTranslate } from "src/hooks/use-translate";
import { SuccessIcon } from "src/icons";
import type { MergedZoneInfo } from "src/lib/zones";

export const CompleteStep = ({
  numZones,
  mergedZones,
}: {
  numZones: number;
  mergedZones: MergedZoneInfo[];
}) => {
  const translate = useTranslate();

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4 py-8">
      <div className="flex flex-col items-center gap-4">
        <SuccessIcon size="xl" className="text-success" />
        <p className="text-size-base text-default">
          {translate("importZones.completeStep.summary", numZones.toString())}
        </p>
      </div>
      {mergedZones.length > 0 && (
        <div className="flex flex-col flex-1 min-h-0 text-size-base w-full">
          <p className="text-subtle mb-2">
            {translate(
              "importZones.completeStep.mergedSummary",
              mergedZones.length.toString(),
            )}
          </p>
          <div className="border rounded-md overflow-hidden flex-1 min-h-0 flex flex-col">
            <div className="overflow-y-auto placemark-scrollbar flex-1 min-h-0">
              <table className="w-full text-size-base">
                <thead>
                  <tr className="bg-panel sticky top-0">
                    <th className="text-left px-3 py-2 font-medium text-subtle">
                      {translate("importZones.completeStep.mergedLabelHeader")}
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-subtle">
                      {translate(
                        "importZones.completeStep.mergedFeaturesHeader",
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mergedZones.map((merged) => (
                    <tr key={merged.label} className="border-t border">
                      <td className="px-3 py-1.5 text-default">
                        {merged.label}
                      </td>
                      <td className="px-3 py-1.5 text-default text-right tabular-nums">
                        {merged.featureCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
