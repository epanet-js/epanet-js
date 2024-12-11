import { useAtom } from "jotai";
import { styledSelect } from "../elements";
import { PanelDetails } from "../panel_details";
import { LinksAnalysis, NodesAnalysis, analysisAtom } from "src/state/analysis";
import { translate } from "src/infra/i18n";
import { ISymbolizationRamp } from "src/types";
import { purple900 } from "src/lib/constants";
import { CBColors, COLORBREWER_ALL } from "src/lib/colorbrewer";
import { Unit } from "@deck.gl/core";
import { isFeatureOn } from "src/infra/feature-flags";

const generateRampStops = (name: string, intervals: number[]) => {
  const pressuresRamp = COLORBREWER_ALL.find((ramp) => ramp.name === name);
  if (!pressuresRamp) throw new Error("Ramp not found!");

  const stops = pressuresRamp.colors[
    intervals.length as keyof CBColors["colors"]
  ]?.map((color: string, i: number) => {
    return { input: intervals[i], output: color };
  });
  return stops as ISymbolizationRamp["stops"];
};

const defaultPressuresSymbolization: ISymbolizationRamp = {
  type: "ramp",
  simplestyle: true,
  property: "pressure",
  unit: "mwc" as Unit,
  defaultColor: purple900,
  defaultOpacity: 0.3,
  interpolate: "step",
  rampName: "epanet-ramp",
  stops: generateRampStops("epanet-ramp", [0, 25, 50, 75, 100]),
};

const defaultFlowsSymbolization: ISymbolizationRamp = {
  type: "ramp",
  simplestyle: true,
  property: "flow",
  unit: "l/s" as Unit,
  defaultColor: purple900,
  defaultOpacity: 0.3,
  interpolate: "step",
  rampName: "epanet-ramp",
  stops: generateRampStops("epanet-ramp", [0, 25, 50, 75, 100]),
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
              aria-label={translate("nodesAnalysis")}
              className={styledSelect({ size: "sm" })}
              value={analysis.nodes.type}
              onChange={(event) => {
                event.target.blur();
                const type = event.target.value as NodesAnalysis["type"];
                switch (type) {
                  case "none":
                    return setAnalysis((prev) => ({
                      ...prev,
                      nodes: { type },
                    }));
                  case "pressures":
                    return setAnalysis((prev) => ({
                      ...prev,
                      nodes: {
                        type: "pressures",
                        symbolization: defaultPressuresSymbolization,
                      },
                    }));
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
        {isFeatureOn("FLAG_FLOWS") && (
          <PanelDetails title={translate("linksAnalysis")}>
            <div className="flex items-center gap-x-2">
              <select
                aria-label={translate("linksAnalysis")}
                className={styledSelect({ size: "sm" })}
                value={analysis.links.type}
                onChange={(event) => {
                  event.target.blur();
                  const type = event.target.value as LinksAnalysis["type"];
                  switch (type) {
                    case "none":
                      return setAnalysis((prev) => ({
                        ...prev,
                        links: { type: "none" },
                      }));
                    case "flows":
                      return setAnalysis((prev) => ({
                        ...prev,
                        links: {
                          type: "flows",
                          symbolization: defaultFlowsSymbolization,
                        },
                      }));
                  }
                }}
              >
                <option value="none">{translate("none")}</option>
                <optgroup label={translate("simulation")}>
                  <option value="flows">{translate("flows")}</option>
                </optgroup>
              </select>
            </div>
          </PanelDetails>
        )}
      </div>
    </div>
  );
};
