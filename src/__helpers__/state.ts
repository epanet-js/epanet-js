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
  initialSimulationState,
  layerConfigAtom,
  momentLogAtom,
  nullData,
  simulationAtom,
  modeAtom,
} from "src/state/jotai";
import { Mode } from "src/state/mode";
import { Asset, HydraulicModel } from "src/hydraulic-model";
import { ExportOptions } from "src/types/export";
import { ILayerConfig, LayerConfigMap } from "src/types";
import { nanoid } from "nanoid";
import { LinkSymbology, NodeSymbology } from "src/map/symbology";
import {
  RangeColorRule,
  nullRangeColorRule,
} from "src/map/symbology/range-color-rule";
import { linkSymbologyAtom, nodeSymbologyAtom } from "src/state/symbology";
import {
  LabelRule,
  nullSymbologySpec,
} from "src/map/symbology/symbology-types";
import { Locale } from "src/infra/i18n/locale";
import { localeAtom } from "src/state/locale";

export const setInitialState = ({
  store = createStore(),
  hydraulicModel = HydraulicModelBuilder.with().build(),
  momentLog = new MomentLog(),
  simulation = initialSimulationState,
  selection = { type: "none" },
  fileInfo = null,
  layerConfigs = new Map(),
  nodeSymbology = nullSymbologySpec.node,
  linkSymbology = nullSymbologySpec.link,
  locale = "en",
  mode = Mode.NONE,
}: {
  store?: Store;
  hydraulicModel?: HydraulicModel;
  momentLog?: MomentLog;
  simulation?: SimulationState;
  selection?: Sel;
  fileInfo?: FileInfo | null;
  layerConfigs?: LayerConfigMap;
  nodeSymbology?: NodeSymbology;
  linkSymbology?: LinkSymbology;
  locale?: Locale;
  mode?: Mode;
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
  store.set(nodeSymbologyAtom, nodeSymbology);
  store.set(linkSymbologyAtom, linkSymbology);
  store.set(localeAtom, locale);
  store.set(modeAtom, { mode });

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
  return {
    status: "success",
    report,
    modelVersion,
  };
};

export const aSimulationFailure = ({
  report = "CONTENT",
  modelVersion = "1",
} = {}): SimulationFinished => {
  return {
    status: "failure",
    report,
    modelVersion,
  };
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

export const aNodeSymbology = ({
  colorRule: partialColorRule = {},
  labelRule = null,
}: {
  colorRule?: Partial<RangeColorRule>;
  labelRule?: LabelRule;
}): NodeSymbology => {
  const colorRule = aRangeColorRule(partialColorRule);
  return {
    colorRule,
    labelRule,
  };
};

export const aLinkSymbology = ({
  colorRule: partialColorRule = {},
  labelRule = null,
}: {
  colorRule?: Partial<RangeColorRule>;
  labelRule?: LabelRule;
}): LinkSymbology => {
  const colorRule = aRangeColorRule({ property: "flow", ...partialColorRule });
  return {
    colorRule,
    labelRule,
  };
};

const anyColor = "#f12345";
export const aRangeColorRule = (
  symbology: Partial<RangeColorRule>,
): RangeColorRule => {
  const defaults: RangeColorRule = {
    ...nullRangeColorRule,
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
