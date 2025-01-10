import { useAtom, useAtomValue } from "jotai";
import { styledSelect } from "../elements";
import { PanelDetails } from "../panel_details";
import { analysisAtom } from "src/state/analysis";
import { translate } from "src/infra/i18n";
import { RangeColorMapping } from "src/analysis/range-color-mapping";
import { LinksAnalysis, NodesAnalysis } from "src/analysis";
import { dataAtom } from "src/state/jotai";

export const AnalysisEditor = () => {
  const [analysis, setAnalysis] = useAtom(analysisAtom);
  const {
    hydraulicModel,
    modelMetadata: { quantities },
  } = useAtomValue(dataAtom);

  return (
    <div className="flex-auto overflow-y-auto placemark-scrollbar">
      <div className="divide-y divide-gray-200 dark:divide-gray-900 border-gray-200 dark:border-gray-900">
        <div className="p-3 space-y-2">
          <div className="text-sm font-bold dark:text-white">
            {translate("analysisSettings")}
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
                        rangeColorMapping: RangeColorMapping.build({
                          steps: [0, 25, 50, 75, 100],
                          property: "pressure",
                          unit: hydraulicModel.units.pressure,
                          paletteName: "epanet-ramp",
                        }),
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
                        rangeColorMapping: RangeColorMapping.build({
                          steps: [0, 25, 50, 75, 100],
                          property: "flow",
                          unit: hydraulicModel.units.flow,
                          paletteName: "epanet-ramp",
                        }),
                      },
                    }));
                  case "velocities":
                    return setAnalysis((prev) => ({
                      ...prev,
                      links: {
                        type: "velocities",
                        rangeColorMapping: RangeColorMapping.build({
                          steps: quantities.analysis.velocitySteps,
                          property: "velocity",
                          unit: hydraulicModel.units.velocity,
                          paletteName: "epanet-ramp",
                        }),
                      },
                    }));
                }
              }}
            >
              <option value="none">{translate("none")}</option>
              <optgroup label={translate("simulation")}>
                <option value="flows">{translate("flows")}</option>
                <option value="velocities">{translate("velocities")}</option>
              </optgroup>
            </select>
          </div>
        </PanelDetails>
      </div>
    </div>
  );
};
