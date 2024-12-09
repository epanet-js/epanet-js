import { useAtom } from "jotai";
import { styledSelect } from "../elements";
import { PanelDetails } from "../panel_details";
import { NodesAnalysis, analysisAtom } from "src/state/analysis";
import { translate } from "src/infra/i18n";
import { ISymbolizationRamp } from "src/types";
import { purple900 } from "src/lib/constants";

const defaultPressuresSymbolization: ISymbolizationRamp = {
  type: "ramp",
  simplestyle: true,
  property: "pressure",
  defaultColor: purple900,
  defaultOpacity: 0.3,
  interpolate: "step",
  rampName: "RdPu",
  stops: [
    { input: 5, output: "rgb(254,235,226)" },
    { input: 10, output: "rgb(252,197,192)" },
    { input: 20, output: "rgb(250,159,181)" },
    { input: 30, output: "rgb(247,104,161)" },
    { input: 40, output: "rgb(221,52,151)" },
    { input: 50, output: "rgb(174,1,126)" },
    { input: 60, output: "rgb(122,1,119)" },
  ],
};

export const AnalysisEditor = () => {
  const [analysis, setAnalysis] = useAtom(analysisAtom);

  return (
    <div className="flex-auto overflow-y-auto placemark-scrollbar">
      <div className="divide-y divide-gray-200 dark:divide-gray-900 border-gray-200 dark:border-gray-900">
        <div className="p-3 space-y-2">
          <div className="text-sm font-bold dark:text-white">
            Analysis settings
          </div>
        </div>
        <PanelDetails title={translate("nodesAnalysis")}>
          <div className="flex items-center gap-x-2">
            <select
              className={styledSelect({ size: "sm" })}
              value={analysis.nodes.type}
              onChange={(event) => {
                const type = event.target.value as NodesAnalysis["type"];
                switch (type) {
                  case "none":
                    return setAnalysis({ nodes: { type } });
                  case "pressures":
                    return setAnalysis({
                      nodes: {
                        type: "pressures",
                        symbolization: defaultPressuresSymbolization,
                      },
                    });
                }
              }}
            >
              <option value="none">{translate("none")}</option>
              <optgroup label={translate("simulation")}>
                <option value="pressures">{translate("pressures")}</option>
              </optgroup>
            </select>
          </div>
        </PanelDetails>
      </div>
    </div>
  );
};
