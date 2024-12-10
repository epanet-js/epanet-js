import { useAtomValue, useSetAtom } from "jotai";
import last from "lodash/last";
import { linearGradient } from "src/lib/color";
import { analysisAtom } from "src/state/analysis";
import { TabOption, tabAtom } from "src/state/jotai";
import { ISymbolizationRamp } from "src/types";
import { Button } from "../elements";
import { Pencil2Icon } from "@radix-ui/react-icons";
import { translate } from "src/infra/i18n";

export const AnalysisLegends = () => {
  const { nodes } = useAtomValue(analysisAtom);

  if (nodes.type === "none") return null;

  return <Legend symbolization={nodes.symbolization} />;
};

const Legend = ({ symbolization }: { symbolization: ISymbolizationRamp }) => {
  return (
    <div className="space-y-1 absolute top-10 left-2 w-48">
      <LegendContainer>
        <LegendRamp symbolization={symbolization} />
      </LegendContainer>
    </div>
  );
};

const LegendTitle = ({ title }: { title: string }) => {
  const setTab = useSetAtom(tabAtom);
  return (
    <div className="block w-full px-2 pt-2 text-right flex justify-between items-center">
      {title}
      <Button
        variant="quiet"
        aria-label="Edit symbolization"
        onClick={() => {
          setTab(TabOption.Analysis);
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
  return (
    <>
      <LegendTitle title={translate(symbolization.property)} />
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

const LegendContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <div
      className="space-y-1 text-xs
      bg-white dark:bg-gray-900
      dark:text-white
      border border-gray-300 dark:border-black w-48 rounded-t"
    >
      {children}
    </div>
  );
};
