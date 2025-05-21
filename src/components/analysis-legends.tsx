import { linearGradient } from "src/lib/color";
import { StyledPopoverArrow } from "./elements";
import { translate, translateUnit } from "src/infra/i18n";
import * as Popover from "@radix-ui/react-popover";
import { StyledPopoverContent } from "src/components/elements";
import { AnalysisRangeEditor } from "./analysis-range-editor";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { useUserTracking } from "src/infra/user-tracking";
import { RangeSymbology } from "src/analysis/range-symbology";
import { useAtomValue } from "jotai";
import { linksAnalysisAtom, nodesAnalysisAtom } from "src/state/analysis";

export const AnalysisLegends = () => {
  const nodesAnalysis = useAtomValue(nodesAnalysisAtom);
  const linksAnalysis = useAtomValue(linksAnalysisAtom);

  return (
    <div className="space-y-1 absolute top-10 left-3 w-48">
      {nodesAnalysis.type !== "none" && (
        <Legend geometryType="nodes" symbology={nodesAnalysis.symbology} />
      )}
      {linksAnalysis.type !== "none" && (
        <Legend geometryType="links" symbology={linksAnalysis.symbology} />
      )}
    </div>
  );
};

const Legend = ({
  geometryType,
  symbology,
}: {
  geometryType: "nodes" | "links";
  symbology: RangeSymbology;
}) => {
  const userTracking = useUserTracking();
  const { breaks, colors, interpolate, property, unit } = symbology;

  const title = unit
    ? `${translate(property)} (${translateUnit(unit)})`
    : translate(property);

  return (
    <Popover.Root>
      <LegendContainer>
        <Popover.Trigger asChild>
          <div
            className="block w-full p-2 flex flex-col justify-between items-start"
            onClick={() => {
              userTracking.capture({
                name: "analysis.legend.clicked",
                property,
              });
            }}
          >
            <div className="pb-2 text-xs text-wrap select-none">{title}</div>
            <div
              className="relative w-4 h-32 rounded dark:border dark:border-white "
              style={{
                background: linearGradient({
                  colors: colors,
                  interpolate: interpolate,
                  vertical: true,
                }),
              }}
            >
              {Array.from({ length: breaks.length }).map((_, i) => {
                const topPct = ((i + 1) / (breaks.length + 1)) * 100;
                return (
                  <div
                    key={breaks[i] + "_" + i}
                    className="absolute left-full ml-2 text-xs whitespace-nowrap select-none"
                    style={{
                      top: `${topPct}%`,
                      transform: "translateY(-50%)",
                    }}
                  >
                    {localizeDecimal(breaks[i])}
                  </div>
                );
              })}
            </div>
          </div>
        </Popover.Trigger>
        <Popover.Portal>
          <StyledPopoverContent
            size="sm"
            onOpenAutoFocus={(e) => e.preventDefault()}
            side="right"
            align="start"
          >
            <StyledPopoverArrow />
            <AnalysisRangeEditor key={property} geometryType={geometryType} />
          </StyledPopoverContent>
        </Popover.Portal>
      </LegendContainer>
    </Popover.Root>
  );
};

const LegendContainer = ({
  onClick,
  children,
}: {
  onClick?: () => void;
  children: React.ReactNode;
}) => {
  return (
    <div
      className="space-y-1 text-xs
      bg-white dark:bg-gray-900
      dark:text-white
      border border-gray-300 dark:border-black w-32 rounded-sm cursor-pointer hover:bg-gray-100"
      onClick={onClick}
    >
      {children}
    </div>
  );
};
