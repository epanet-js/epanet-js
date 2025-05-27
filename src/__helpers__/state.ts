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
import {
  RangeSymbology,
  nullRangeSymbology,
} from "src/analysis/range-symbology";
import { linksAnalysisAtom, nodesAnalysisAtom } from "src/state/analysis";
import { Labeling } from "src/analysis/analysis-types";

export const setInitialState = ({
  store = createStore(),
  hydraulicModel = HydraulicModelBuilder.with().build(),
  momentLog = new MomentLog(),
  simulation = { status: "idle" },
  selection = { type: "none" },
  fileInfo = null,
  layerConfigs = new Map(),
  nodesAnalysis = { type: "none", labeling: null },
  linksAnalysis = { type: "none", labeling: null },
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
  store.set(nodesAnalysisAtom, nodesAnalysis);
  store.set(linksAnalysisAtom, linksAnalysis);

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

export const aNodesAnalysis = ({
  symbology: partialSymbology,
  labeling = null,
}: {
  symbology: Partial<RangeSymbology>;
  labeling?: Labeling;
}): NodesAnalysis => {
  const symbology = aSymbology(partialSymbology);
  return {
    type: symbology.property as NodesAnalysis["type"],
    symbology,
    labeling,
  };
};

export const aLinksAnalysis = ({
  symbology: partialSymbology,
  labeling = null,
}: {
  symbology: Partial<RangeSymbology>;
  labeling?: Labeling;
}): LinksAnalysis => {
  const symbology = aSymbology(partialSymbology);
  return {
    type: symbology.property as LinksAnalysis["type"],
    symbology,
    labeling,
  };
};

const anyColor = "#f12345";
export const aSymbology = (
  symbology: Partial<RangeSymbology>,
): RangeSymbology => {
  const defaults: RangeSymbology = {
    ...nullRangeSymbology,
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

  const breaks = symbology.breaks || defaults.breaks;
  const colors = symbology.colors || defaults.colors;

  return {
    ...defaults,
    ...symbology,
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
