import { useAtom, useSetAtom } from "jotai";
import last from "lodash/last";
import { linearGradient } from "src/lib/color";
import { analysisAtom } from "src/state/analysis";
import { TabOption, dialogAtom, tabAtom } from "src/state/jotai";
import { ISymbolizationRamp } from "src/types";
import { Button, StyledPopoverArrow } from "./elements";
import { Pencil2Icon } from "@radix-ui/react-icons";
import { translate, translateUnit } from "src/infra/i18n";
import { isFeatureOn } from "src/infra/feature-flags";
import * as Popover from "@radix-ui/react-popover";
import { StyledPopoverContent } from "src/components/elements";
import { RangeColorMapping } from "src/analysis/range-color-mapping";
import { RampWizard } from "src/components/dialogs/symbolization-dialog";

export const AnalysisLegends = () => {
  const [{ nodes, links }, setAnalysis] = useAtom(analysisAtom);

  const handleNodesChange = (newSymbolization: ISymbolizationRamp) => {
    setAnalysis((prev) => ({
      ...prev,
      nodes: {
        type: "pressures",
        rangeColorMapping:
          RangeColorMapping.fromSymbolizationRamp(newSymbolization),
      },
    }));
  };

  return (
    <div className="space-y-1 absolute top-10 left-3 w-48">
      {nodes.type !== "none" &&
        (isFeatureOn("FLAG_CUSTOMIZE") ? (
          <Legend
            symbolization={nodes.rangeColorMapping.symbolization}
            onChange={handleNodesChange}
          />
        ) : (
          <LegendDeprecated
            symbolization={nodes.rangeColorMapping.symbolization}
          />
        ))}
      {links.type !== "none" && (
        <LegendDeprecated
          symbolization={links.rangeColorMapping.symbolization}
        />
      )}
    </div>
  );
};

const Legend = ({
  symbolization,
  onChange,
}: {
  symbolization: ISymbolizationRamp;
  onChange: (newSymbolization: ISymbolizationRamp) => void;
}) => {
  const title = symbolization.unit
    ? `${translate(symbolization.property)} (${translateUnit(symbolization.unit)})`
    : translate(symbolization.property);

  const stops = [...symbolization.stops];
  const totalStops = stops.length;

  return (
    <Popover.Root>
      <LegendContainer>
        <Popover.Trigger asChild>
          <div className="block w-full p-2 text-right flex flex-col justify-between items-start">
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
                    key={stops[i + 1].input}
                    className="absolute left-full ml-2 text-xs whitespace-nowrap select-none"
                    style={{
                      top: `${topPct}%`,
                      transform: "translateY(-50%)",
                    }}
                  >
                    {stops[i + 1].input}
                  </div>
                );
              })}
            </div>
          </div>
        </Popover.Trigger>
        <Popover.Portal>
          <StyledPopoverContent
            size="md"
            onOpenAutoFocus={(e) => e.preventDefault()}
            side="right"
            align="start"
          >
            <StyledPopoverArrow />
            <RampWizard symbolization={symbolization} onChange={onChange} />
          </StyledPopoverContent>
        </Popover.Portal>
      </LegendContainer>
    </Popover.Root>
  );
};

const LegendDeprecated = ({
  symbolization,
}: {
  symbolization: ISymbolizationRamp;
}) => {
  return (
    <LegendContainerDeprecated>
      <LegendRamp symbolization={symbolization} />
    </LegendContainerDeprecated>
  );
};

const LegendTitle = ({ title }: { title: string }) => {
  const setTab = useSetAtom(tabAtom);
  const setDialogState = useSetAtom(dialogAtom);

  return (
    <div className="block w-full px-2 pt-2 text-right flex justify-between items-center">
      {title}
      <Button
        variant="quiet"
        aria-label="Edit symbolization"
        onClick={() => {
          isFeatureOn("FLAG_CUSTOMIZE")
            ? setDialogState({ type: "symbolization" })
            : setTab(TabOption.Analysis);
        }}
      >
        <Pencil2Icon className="w-3 h-3" />
      </Button>
    </div>
  );
};

const LegendRamp = ({
  symbolization,
}: {
  symbolization: ISymbolizationRamp;
}) => {
  const title = symbolization.unit
    ? `${translate(symbolization.property)} (${translateUnit(symbolization.unit)})`
    : translate(symbolization.property);
  return (
    <>
      <LegendTitle title={title} />
      <div className="p-2">
        <div
          className="h-4 rounded dark:border dark:border-white"
          style={{
            background: linearGradient({
              colors: symbolization.stops.map((stop) => stop.output),
              interpolate: symbolization.interpolate,
            }),
          }}
        />
        <div className="flex justify-between pt-1">
          <div className="truncate">{symbolization.stops[0]?.input}</div>
          <div className="truncate">
            {last(symbolization.stops)?.input + "+"}
          </div>
        </div>
      </div>
    </>
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

const LegendContainerDeprecated = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <div
      className="space-y-1 text-xs
      bg-white dark:bg-gray-900
      dark:text-white
  border border-gray-300 dark:border-black w-48 rounded-sm"
    >
      {children}
    </div>
  );
};
