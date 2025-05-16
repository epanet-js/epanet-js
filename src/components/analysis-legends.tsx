import { useAtom } from "jotai";
import { linearGradient } from "src/lib/color";
import { analysisAtom } from "src/state/analysis";
import { StyledPopoverArrow } from "./elements";
import { translate, translateUnit } from "src/infra/i18n";
import * as Popover from "@radix-ui/react-popover";
import { StyledPopoverContent } from "src/components/elements";
import { AnalysisRangeEditor } from "./analysis-range-editor";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { useUserTracking } from "src/infra/user-tracking";
import { SymbolizationRamp } from "src/analysis/symbolization-ramp";

export const AnalysisLegends = () => {
  const [{ nodes, links }] = useAtom(analysisAtom);

  return (
    <div className="space-y-1 absolute top-10 left-3 w-48">
      {nodes.type !== "none" && (
        <Legend
          geometryType="nodes"
          symbolization={nodes.rangeColorMapping.symbolization}
        />
      )}
      {links.type !== "none" && (
        <Legend
          geometryType="links"
          symbolization={links.rangeColorMapping.symbolization}
        />
      )}
    </div>
  );
};

const Legend = ({
  geometryType,
  symbolization,
}: {
  geometryType: "nodes" | "links";
  symbolization: SymbolizationRamp;
}) => {
  const userTracking = useUserTracking();
  const title = symbolization.unit
    ? `${translate(symbolization.property)} (${translateUnit(symbolization.unit)})`
    : translate(symbolization.property);

  const stops = [...symbolization.stops];
  const totalStops = stops.length;

  return (
    <Popover.Root>
      <LegendContainer>
        <Popover.Trigger asChild>
          <div
            className="block w-full p-2 text-right flex flex-col justify-between items-start"
            onClick={() => {
              userTracking.capture({
                name: "analysis.legend.clicked",
                property: symbolization.property,
              });
            }}
          >
            <div className="pb-2 text-xs whitespace-nowrap select-none">
              {title}
            </div>
            <div
              className="relative w-4 h-32 rounded dark:border dark:border-white "
              style={{
                background: linearGradient({
                  colors: stops.map((stop) => stop.output),
                  interpolate: symbolization.interpolate,
                  vertical: true,
                }),
              }}
            >
              {Array.from({ length: totalStops - 1 }).map((_, i) => {
                const topPct = ((i + 1) / totalStops) * 100;
                return (
                  <div
                    key={stops[i + 1].input + "_" + i}
                    className="absolute left-full ml-2 text-xs whitespace-nowrap select-none"
                    style={{
                      top: `${topPct}%`,
                      transform: "translateY(-50%)",
                    }}
                  >
                    {localizeDecimal(stops[i + 1].input)}
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
            <AnalysisRangeEditor
              key={symbolization.property}
              geometryType={geometryType}
            />
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
