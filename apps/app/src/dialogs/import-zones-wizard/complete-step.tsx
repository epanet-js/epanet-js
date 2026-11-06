import { Callout } from "@epanet-js/ui-kit";
import { useTranslate } from "src/hooks/use-translate";
import { SuccessIcon } from "src/icons";
import type { RenamedZoneInfo } from "@epanet-js/converters";
import type { SummaryRow } from "./import-summary";

export const CompleteStep = ({
  numZones,
  columns,
  rows,
  renamedZones,
}: {
  numZones: number;
  columns: string[];
  rows: SummaryRow[];
  renamedZones: RenamedZoneInfo[];
}) => {
  const translate = useTranslate();
  const mergedCount = rows.filter((row) => row.featureCount > 1).length;

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4 py-8">
      <div className="flex flex-col items-center gap-4">
        <SuccessIcon size="xl" className="text-success" />
        <p className="text-size-base text-default">
          {translate("importZones.completeStep.summary", numZones.toString())}
        </p>
      </div>
      {renamedZones.length > 0 && (
        <Callout
          variant="info"
          title={translate(
            "importZones.completeStep.renamedSummary",
            renamedZones.length.toString(),
          )}
        >
          <ul className="text-size-base">
            {renamedZones.map((renamed) => (
              <li key={renamed.label}>
                {translate(
                  "importZones.completeStep.renamedZone",
                  renamed.originalLabel,
                  renamed.label,
                )}
              </li>
            ))}
          </ul>
        </Callout>
      )}
      {rows.length > 0 && (
        <div className="flex flex-col flex-1 min-h-0 text-size-base w-full">
          {mergedCount > 0 && (
            <p className="text-subtle mb-2">
              {translate(
                "importZones.completeStep.mergedSummary",
                mergedCount.toString(),
              )}
            </p>
          )}
          <div className="border rounded-md overflow-hidden flex-1 min-h-0 flex flex-col">
            <div className="overflow-auto placemark-scrollbar flex-1 min-h-0">
              <table className="w-full text-size-base">
                <thead>
                  <tr className="bg-panel sticky top-0">
                    <th className="text-left px-3 py-2 font-medium text-subtle">
                      {translate("importZones.completeStep.mergedLabelHeader")}
                    </th>
                    {columns.map((column) => (
                      <th
                        key={column}
                        className="text-left px-3 py-2 font-medium text-subtle"
                      >
                        {column}
                      </th>
                    ))}
                    <th className="text-right px-3 py-2 font-medium text-subtle">
                      {translate(
                        "importZones.completeStep.mergedFeaturesHeader",
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label} className="border-t border">
                      <td className="px-3 py-1.5 text-default">{row.label}</td>
                      {row.values.map((value, i) => (
                        <td key={i} className="px-3 py-1.5 text-default">
                          {value ?? ""}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-default text-right tabular-nums">
                        {row.featureCount}
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
