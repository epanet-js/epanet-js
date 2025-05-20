import { atom, useAtom } from "jotai";
import { AnalysisState, LinksAnalysis, NodesAnalysis } from "src/analysis";
import {
  linksAnalysisAtomDeprecated,
  nodesAnalysisAtomDeprecated,
} from "./analysis-deprecated";

export type { AnalysisState };

export const analysisSettingsAtom = atom<
  Map<string, NodesAnalysis | LinksAnalysis>
>(new Map());

export const useAnalysisSettings = () => {
  const [settings, setSettings] = useAtom(analysisSettingsAtom);
  const [nodesAnalysis, setNodesActive] = useAtom(nodesAnalysisAtomDeprecated);
  const [linksAnalysis, setLinksActive] = useAtom(linksAnalysisAtomDeprecated);

  const switchNodesAnalysisTo = (
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

  const switchLinksAnalysisTo = (
    type: LinksAnalysis["type"],
    initializeFn: () => LinksAnalysis,
  ) => {
    if (settings.has(type)) {
      const linksSettings = settings.get(type) as LinksAnalysis;
      setLinksActive(linksSettings);
    } else {
      const linksSettings = initializeFn();
      setLinksActive(linksSettings);
      const updatedSettings = new Map([...settings.entries()]);
      updatedSettings.set(linksSettings.type, linksSettings);
      setSettings(updatedSettings);
    }
  };

  const updateNodesAnalysis = (nodesSettings: NodesAnalysis) => {
    setNodesActive(nodesSettings);
    const updatedSettings = new Map([...settings.entries()]);
    updatedSettings.set(nodesSettings.type, nodesSettings);
    setSettings(updatedSettings);
  };

  const updateLinksAnalysis = (linksSettings: LinksAnalysis) => {
    setLinksActive(linksSettings);
    const updatedSettings = new Map([...settings.entries()]);
    updatedSettings.set(linksSettings.type, linksSettings);
    setSettings(updatedSettings);
  };

  return {
    linksAnalysis,
    nodesAnalysis,
    switchNodesAnalysisTo,
    switchLinksAnalysisTo,
    updateNodesAnalysis,
    updateLinksAnalysis,
  };
};
