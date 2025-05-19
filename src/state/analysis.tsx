import { atom, useAtom } from "jotai";
import { AnalysisState, LinksAnalysis, NodesAnalysis } from "src/analysis";
import { nodesAnalysisAtomDeprecated } from "./analysis-deprecated";

export type { AnalysisState };

export const analysisSettingsAtom = atom<
  Map<string, NodesAnalysis | LinksAnalysis>
>(new Map());

export const useAnalysisSettings = () => {
  const [settings, setSettings] = useAtom(analysisSettingsAtom);
  const [nodes, setNodesActive] = useAtom(nodesAnalysisAtomDeprecated);

  const setNodesAnalysis = (
    type: NodesAnalysis["type"],
    initializeFn: () => NodesAnalysis,
  ) => {
    if (settings.has(type)) {
      const nodesSettings = settings.get(type) as NodesAnalysis;
      setNodesActive(nodesSettings);
    } else {
      const nodesSettings = initializeFn();
      setNodesActive(nodesSettings);
      const updatedSettings = new Map([...settings.entries()]);
      updatedSettings.set(nodesSettings.type, nodesSettings);
      setSettings(updatedSettings);
    }
  };

  const updateNodesAnalysis = (nodesSettings: NodesAnalysis) => {
    setNodesActive(nodesSettings);
    const updatedSettings = new Map([...settings.entries()]);
    updatedSettings.set(nodesSettings.type, nodesSettings);
    setSettings(updatedSettings);
  };

  return {
    nodes,
    setNodesAnalysis,
    updateNodesAnalysis,
  };
};
