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
import { ILayerConfig, ISymbolizationRamp, LayerConfigMap } from "src/types";
import { nanoid } from "nanoid";
import { LinksAnalysis, NodesAnalysis } from "src/analysis";
import { analysisAtom } from "src/state/analysis";
import { RangeColorMapping } from "src/analysis/range-color-mapping";

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
  store.set(analysisAtom, { links: linksAnalysis, nodes: nodesAnalysis });

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
  symbolization: Partial<ISymbolizationRamp>,
): NodesAnalysis => {
  return {
    type: "pressure",
    rangeColorMapping: RangeColorMapping.fromSymbolizationRamp(
      aSymbolization(symbolization),
    ),
  };
};

export const aLinksAnalysis = (
  symbolization: Partial<ISymbolizationRamp>,
): LinksAnalysis => {
  return {
    type: "flow",
    rangeColorMapping: RangeColorMapping.fromSymbolizationRamp(
      aSymbolization(symbolization),
    ),
  };
};

export const aSymbolization = (
  symbolization: Partial<ISymbolizationRamp>,
): ISymbolizationRamp => {
  const defaults: ISymbolizationRamp = {
    type: "ramp",
    simplestyle: true,
    property: "pressure",
    unit: "m",
    defaultColor: "#ff00ff",
    defaultOpacity: 0.3,
    interpolate: "step",
    rampName: "epanet-ramp",
    mode: "equalIntervals",
    stops: [],
    absValues: false,
    fallbackEndpoints: [0, 100],
  };

  return {
    ...defaults,
    ...symbolization,
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
