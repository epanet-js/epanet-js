import { createStore } from "jotai";
import { HydraulicModelBuilder } from "./hydraulic-model-builder";
import { MomentLog } from "src/lib/persistence/moment-log";
import { dataAtom, nullData } from "src/state/data";
import { FileInfo, inpFileInfoAtom } from "src/state/file-system";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { layerConfigAtom } from "src/state/map";
import { modeAtom } from "src/state/mode";
import { momentLogAtom } from "src/state/model-changes";
import {
  SimulationFinished,
  SimulationState,
  initialSimulationState,
  simulationStepAtom,
} from "src/state/simulation";
import { simulationSettingsAtom } from "src/state/simulation-settings";
import { Store } from "src/state";
import type { ResultsReader } from "src/simulation/results-reader";
import { Mode } from "src/state/mode";
import { Asset, HydraulicModel } from "src/hydraulic-model";
import { ExportOptions } from "src/types/export";
import { ILayerConfig, LayerConfigMap } from "src/types";
import type { Sel } from "src/selection/types";
import { nanoid } from "nanoid";
import {
  LinkSymbology,
  NodeSymbology,
  nullSymbologySpec,
} from "src/map/symbology";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import {
  RangeColorRule,
  nullRangeColorRule,
} from "src/map/symbology/range-color-rule";
import { linkSymbologyAtom, nodeSymbologyAtom } from "src/state/map-symbology";
import { LabelRule } from "src/map/symbology/symbology-types";
import { Locale } from "src/infra/i18n/locale";
import { localeAtom } from "src/state/locale";
import { branchStateAtom } from "src/state/branch-state";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";

export const setInitialState = (
  args: {
    store?: Store;
    hydraulicModel?: HydraulicModel;
    momentLog?: MomentLog;
    selection?: Sel;
    fileInfo?: FileInfo | null;
    layerConfigs?: LayerConfigMap;
    nodeSymbology?: NodeSymbology;
    linkSymbology?: LinkSymbology;
    locale?: Locale;
    mode?: Mode;
    simulation?: SimulationState;
    simulationStep?: number | null;
    simulationResults?: ResultsReader | null;
    simulationSettings?: SimulationSettings;
  } = {},
): Store => {
  const {
    store = createStore(),
    hydraulicModel = HydraulicModelBuilder.with().build(),
    momentLog = new MomentLog(),
    selection = { type: "none" },
    fileInfo = null,
    layerConfigs = new Map(),
    nodeSymbology = nullSymbologySpec.node,
    linkSymbology = nullSymbologySpec.link,
    locale = "en",
    mode = Mode.NONE,
    simulation = initialSimulationState,
    simulationStep = null,
    simulationResults = null,
    simulationSettings,
  } = args;
  const simulationStepWasExplicit = "simulationStep" in args;
  store.set(stagingModelAtom, hydraulicModel);
  store.set(dataAtom, {
    ...nullData,
    selection,
  });
  store.set(momentLogAtom, momentLog);
  store.set(simulationStepAtom, simulationStep);
  store.set(inpFileInfoAtom, fileInfo);
  store.set(layerConfigAtom, layerConfigs);
  store.set(nodeSymbologyAtom, nodeSymbology);
  store.set(linkSymbologyAtom, linkSymbology);
  store.set(localeAtom, locale);
  store.set(modeAtom, { mode });
  if (simulationResults) {
    if (!simulationStepWasExplicit) {
      store.set(simulationStepAtom, 0);
    }
  }
  if (simulationSettings) {
    store.set(simulationSettingsAtom, simulationSettings);
  }

  const branchSimulation: SimulationState =
    simulationResults && !("epsResultsReader" in simulation)
      ? ({
          status: "success",
          report: "",
          modelVersion: hydraulicModel.version,
          settingsVersion: "",
          epsResultsReader: {
            timestepCount: 1,
            getResultsForTimestep: () => Promise.resolve(simulationResults),
          },
        } as unknown as SimulationState)
      : simulation;

  store.set(
    branchStateAtom,
    new Map([
      [
        "main",
        {
          version: hydraulicModel.version,
          hydraulicModel,
          labelManager: new LabelManager(),
          momentLog,
          simulation: branchSimulation,
          simulationSourceId: "main",
          simulationSettings: simulationSettings ?? defaultSimulationSettings,
        },
      ],
    ]),
  );

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
  return { ...defaults, ...data } as ILayerConfig;
};

export const aFileInfo = (data: Partial<FileInfo> | null) => {
  const defaults = {
    modelVersion: "ANY",
    name: "NAME",
    handle: undefined,
    isMadeByApp: true,
    isDemoNetwork: false,
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
    settingsVersion: "",
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
    settingsVersion: "",
  };
};

export const aSingleSelection = ({
  id = 1,
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
    ...nullSymbologySpec.node,
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
    ...nullSymbologySpec.link,
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

export type SimulationData = {
  pipes?: Record<
    number,
    Partial<{
      flow: number;
      velocity: number;
      headloss: number;
      unitHeadloss: number;
      status: "open" | "closed";
      waterAge: number | null;
      waterTrace: number | null;
      chemicalConcentration: number | null;
    }>
  >;
  junctions?: Record<
    number,
    Partial<{
      pressure: number;
      head: number;
      demand: number;
      waterAge: number | null;
      waterTrace: number | null;
      chemicalConcentration: number | null;
    }>
  >;
  pumps?: Record<
    number,
    Partial<{
      flow: number;
      headloss: number;
      status: "on" | "off";
      statusWarning: "cannot-deliver-flow" | "cannot-deliver-head" | null;
      waterAge: number | null;
      waterTrace: number | null;
      chemicalConcentration: number | null;
    }>
  >;
  valves?: Record<
    number,
    Partial<{
      flow: number;
      velocity: number;
      headloss: number;
      status: "active" | "open" | "closed";
      statusWarning: "cannot-deliver-flow" | "cannot-deliver-pressure" | null;
      waterAge: number | null;
      waterTrace: number | null;
      chemicalConcentration: number | null;
    }>
  >;
  tanks?: Record<
    number,
    Partial<{
      pressure: number;
      head: number;
      netFlow: number;
      level: number;
      volume: number;
      waterAge: number | null;
      waterTrace: number | null;
      chemicalConcentration: number | null;
    }>
  >;
  reservoirs?: Record<
    number,
    Partial<{
      pressure: number;
      head: number;
      netFlow: number;
      waterAge: number | null;
      waterTrace: number | null;
      chemicalConcentration: number | null;
    }>
  >;
};

export const createMockResultsReader = (
  data: SimulationData = {},
): ResultsReader => ({
  getPipe: (id) => {
    const sim = data.pipes?.[id];
    if (!sim) return null;
    return {
      type: "pipe",
      flow: sim.flow ?? 0,
      velocity: sim.velocity ?? 0,
      headloss: sim.headloss ?? 0,
      unitHeadloss: sim.unitHeadloss ?? 0,
      status: sim.status ?? "open",
      waterAge: sim.waterAge ?? null,
      waterTrace: sim.waterTrace ?? null,
      chemicalConcentration: sim.chemicalConcentration ?? null,
    };
  },
  getJunction: (id) => {
    const sim = data.junctions?.[id];
    if (!sim) return null;
    return {
      type: "junction",
      pressure: sim.pressure ?? 0,
      head: sim.head ?? 0,
      demand: sim.demand ?? 0,
      waterAge: sim.waterAge ?? null,
      waterTrace: sim.waterTrace ?? null,
      chemicalConcentration: sim.chemicalConcentration ?? null,
    };
  },
  getPump: (id) => {
    const sim = data.pumps?.[id];
    if (!sim) return null;
    return {
      type: "pump",
      flow: sim.flow ?? 0,
      headloss: sim.headloss ?? 0,
      status: sim.status ?? "on",
      statusWarning: sim.statusWarning ?? null,
      waterAge: sim.waterAge ?? null,
      waterTrace: sim.waterTrace ?? null,
      chemicalConcentration: sim.chemicalConcentration ?? null,
    };
  },
  getValve: (id) => {
    const sim = data.valves?.[id];
    if (!sim) return null;
    return {
      type: "valve",
      flow: sim.flow ?? 0,
      velocity: sim.velocity ?? 0,
      headloss: sim.headloss ?? 0,
      status: sim.status ?? "active",
      statusWarning: sim.statusWarning ?? null,
      waterAge: sim.waterAge ?? null,
      waterTrace: sim.waterTrace ?? null,
      chemicalConcentration: sim.chemicalConcentration ?? null,
    };
  },
  getTank: (id) => {
    const sim = data.tanks?.[id];
    if (!sim) return null;
    return {
      type: "tank",
      pressure: sim.pressure ?? 0,
      head: sim.head ?? 0,
      netFlow: sim.netFlow ?? 0,
      level: sim.level ?? 0,
      volume: sim.volume ?? 0,
      waterAge: sim.waterAge ?? null,
      waterTrace: sim.waterTrace ?? null,
      chemicalConcentration: sim.chemicalConcentration ?? null,
    };
  },
  getReservoir: (id) => {
    const sim = data.reservoirs?.[id];
    if (!sim) return null;
    return {
      type: "reservoir",
      pressure: sim.pressure ?? 0,
      head: sim.head ?? 0,
      netFlow: sim.netFlow ?? 0,
      waterAge: sim.waterAge ?? null,
      waterTrace: sim.waterTrace ?? null,
      chemicalConcentration: sim.chemicalConcentration ?? null,
    };
  },
  getAllValues: (property) => {
    const junctions = Object.values(data.junctions ?? {});
    const pipes = Object.values(data.pipes ?? {});
    switch (property) {
      case "pressure":
        return junctions.map((j) => j.pressure ?? 0);
      case "head":
        return junctions.map((j) => j.head ?? 0);
      case "actualDemand":
        return junctions.map((j) => j.demand ?? 0);
      case "flow":
        return pipes.map((p) => p.flow ?? 0);
      case "velocity":
        return pipes.map((p) => p.velocity ?? 0);
      default:
        return [];
    }
  },
  getPumpEnergy: () => null,
});
