import { useAtom } from "jotai";
import { styledSelect } from "../elements";
import { PanelDetails } from "../panel_details";
import { NodesAnalysis, analysisAtom } from "src/state/analysis";
import { translate } from "src/infra/i18n";

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
              value={analysis.nodes}
              onChange={(event) => {
                const type = event.target.value as NodesAnalysis;
                setAnalysis({ nodes: type });
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
