import { createStore } from "jotai";
import { HydraulicModelBuilder } from "./hydraulic-model-builder";
import { MomentLog } from "src/lib/persistence/moment-log";
import {
  FileInfo,
  Sel,
  SimulationFinished,
  SimulationState,
  Store,
  dataAtom,
  fileInfoAtom,
  layerConfigAtom,
  momentLogAtom,
  nullData,
  simulationAtom,
} from "src/state/jotai";
import { Asset, HydraulicModel } from "src/hydraulic-model";
import { ExportOptions } from "src/lib/convert";
import { ILayerConfig, LayerConfigMap } from "src/types";
import { nanoid } from "nanoid";
import { LinksAnalysis, NodesAnalysis } from "src/analysis";
import { analysisAtomDeprecated } from "src/state/analysis-deprecated";
import {
  SymbolizationRamp,
  nullRampSymbolization,
} from "src/analysis/symbolization-ramp";

export const setInitialState = ({
  store = createStore(),
  hydraulicModel = HydraulicModelBuilder.with().build(),
  momentLog = new MomentLog(),
  simulation = { status: "idle" },
  selection = { type: "none" },
  fileInfo = null,
  layerConfigs = new Map(),
  nodesAnalysis = { type: "none" },
  linksAnalysis = { type: "none" },
}: {
  store?: Store;
  hydraulicModel?: HydraulicModel;
  momentLog?: MomentLog;
  simulation?: SimulationState;
  selection?: Sel;
  fileInfo?: FileInfo | null;
  layerConfigs?: LayerConfigMap;
  nodesAnalysis?: NodesAnalysis;
  linksAnalysis?: LinksAnalysis;
} = {}): Store => {
  store.set(dataAtom, {
    ...nullData,
    selection,
    hydraulicModel: hydraulicModel,
  });
  store.set(momentLogAtom, momentLog);
  store.set(simulationAtom, simulation);
  store.set(fileInfoAtom, fileInfo);
  store.set(layerConfigAtom, layerConfigs);
  store.set(analysisAtomDeprecated, {
    links: linksAnalysis,
    nodes: nodesAnalysis,
  });

  return store;
};

export const aLayerConfig = (
  data: Partial<ILayerConfig> = {},
): ILayerConfig => {
  const defaults: ILayerConfig = {
    id: nanoid(),
    name: "NAME",
    type: "MAPBOX",
    token: "TOKEN",
    url: "URL",
    opacity: 1,
    sourceMaxZoom: {},
    isBasemap: false,
    at: "a0",
    tms: false,
    visibility: true,
    labelVisibility: true,
  };
  return { ...defaults, ...data };
};

export const aFileInfo = (data: Partial<FileInfo> | null) => {
  const defaults = {
    modelVersion: "ANY",
    name: "NAME",
    handle: undefined,
    isMadeByApp: true,
    options: { type: "inp", folderId: "" } as ExportOptions,
  };
  return { ...defaults, ...data };
};

export const aSimulationSuccess = ({
  report = "CONTENT",
  modelVersion = "1",
} = {}): SimulationFinished => {
  return { status: "success", report, modelVersion };
};

export const aSimulationFailure = ({
  report = "CONTENT",
  modelVersion = "1",
} = {}): SimulationFinished => {
  return { status: "failure", report, modelVersion };
};

export const aSingleSelection = ({
  id = "id",
}: { id?: Asset["id"] } = {}): Sel => {
  return {
    type: "single",
    id,
    parts: [],
  };
};

export const aNodesAnalysis = (
  symbolization: Partial<SymbolizationRamp>,
): NodesAnalysis => {
  return {
    type: "pressure",
    symbolization: aSymbolization(symbolization),
  };
};

export const aLinksAnalysis = (
  symbolization: Partial<SymbolizationRamp>,
): LinksAnalysis => {
  return {
    type: "flow",
    symbolization: aSymbolization(symbolization),
  };
};

const anyColor = "#f12345";
export const aSymbolization = (
  symbolization: Partial<SymbolizationRamp>,
): SymbolizationRamp => {
  const defaults: SymbolizationRamp = {
    ...nullRampSymbolization,
    property: "pressure",
    unit: "m",
    interpolate: "step",
    rampName: "Temps",
    mode: "equalIntervals",
    absValues: false,
    fallbackEndpoints: [0, 100],
    breaks: [20, 30],
    colors: [anyColor, anyColor, anyColor],
  };

  const breaks = symbolization.breaks || defaults.breaks;
  const colors = symbolization.colors || defaults.colors;

  return {
    ...defaults,
    ...symbolization,
    breaks,
    colors,
  };
};

export const aMultiSelection = ({
  ids = [],
}: { ids?: Asset["id"][] } = {}): Sel => {
  return {
    type: "multi",
    ids,
  };
};

export const nullSelection: Sel = { type: "none" };
