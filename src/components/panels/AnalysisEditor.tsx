import { useAtom, useAtomValue } from "jotai";
import { styledSelect } from "../elements";
import { PanelDetails } from "../panel_details";
import { analysisAtom } from "src/state/analysis";
import { translate } from "src/infra/i18n";
import { RangeColorMapping } from "src/analysis/range-color-mapping";
import { LinksAnalysis, NodesAnalysis } from "src/analysis";
import { dataAtom } from "src/state/jotai";
import { isFeatureOn } from "src/infra/feature-flags";

export const AnalysisEditor = () => {
  const [analysis, setAnalysis] = useAtom(analysisAtom);
  const { hydraulicModel } = useAtomValue(dataAtom);

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
                        rangeColorMapping: RangeColorMapping.build({
                          steps: [0, 25, 50, 75, 100],
                          property: "pressure",
                          unit: isFeatureOn("FLAG_MODEL_UNITS")
                            ? hydraulicModel.units.junction.pressure
                            : "l/s",
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
                          unit: isFeatureOn("FLAG_MODEL_UNITS")
                            ? hydraulicModel.units.pipe.flow
                            : "l/s",
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
              </optgroup>
            </select>
          </div>
        </PanelDetails>
      </div>
    </div>
  );
};
