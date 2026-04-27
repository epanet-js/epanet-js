import { screen, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { CommandContainer } from "./__helpers__/command-container";
import {
  setInitialState,
  createMockResultsReader,
} from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Export } from "src/lib/export";
import { Store } from "src/state";
import { useExportData, DataExportOptions } from "./export-data";
import { Junction } from "src/hydraulic-model";
import type { SimulationState } from "src/state/simulation";
import { stubFileSave, lastSaveCall } from "src/__helpers__/browser-fs-mock";
import { ExportEntry } from "src/lib/export/types";

describe("export-data", () => {
  beforeEach(() => {
    vi.spyOn(Export, "exportFile").mockResolvedValue({
      blob: new Blob(),
      fileName: "export.geojson",
      description: "GeoJSON",
      extensions: [".geojson"],
      mimeTypes: ["application/geo+json"],
    });
    stubFileSave({ fileName: "export.geojson" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports all model assets in a single file, saving to disk", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const store = setInitialState({ hydraulicModel });
    renderComponent({ store });

    await triggerExport({
      format: "geojson",
      includeSimulationResults: false,
    });

    const [, files] = vi.mocked(Export.exportFile).mock.calls[0];
    expect(files[0].format).toBe("geojson");
    expectFilesToBePresent(files, [
      "junction",
      "tank",
      "reservoir",
      "pipe",
      "pump",
      "valve",
    ]);

    const junctionsData = files[0].data as {
      id: number;
      geometry: { type: string };
    }[];
    expect(junctionsData).toHaveLength(2);
    expect(junctionsData.map((f) => f.id)).toEqual(
      expect.arrayContaining([IDS.J1, IDS.J2]),
    );
    expect(junctionsData[0]).toHaveProperty("geometry");
    expect(junctionsData[0].geometry.type).toEqual("Point");
    expect(junctionsData[0]).not.toHaveProperty("sim_pressure");

    const pipesData = files[3].data as { id: number }[];
    expect(pipesData.map((f) => f.id)).toEqual(
      expect.arrayContaining([IDS.P1]),
    );

    const { options, handle } = lastSaveCall();
    expect(options).toEqual({
      fileName: "export.geojson",
      extensions: [".geojson"],
      description: "GeoJSON",
      mimeTypes: ["application/geo+json"],
    });
    expect(handle).toBeNull();
  });

  it("includes all asset-specific properties", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const store = setInitialState({ hydraulicModel });
    renderComponent({ store });

    await triggerExport({
      format: "geojson",
      includeSimulationResults: false,
    });

    const [, files] = vi.mocked(Export.exportFile).mock.calls[0];

    const junctionsData = files[0].data as Record<string, unknown>[];
    const junction = junctionsData.find((f) => f.id === IDS.J1);
    expect(junction).toMatchObject({
      id: IDS.J1,
      type: "junction",
      label: hydraulicModel.assets.get(IDS.J1)?.label,
      isActive: hydraulicModel.assets.get(IDS.J1)?.isActive,
      elevation: (hydraulicModel.assets.get(IDS.J1) as Junction)?.elevation,
      emitterCoefficient: (hydraulicModel.assets.get(IDS.J1) as Junction)
        ?.emitterCoefficient,
    });
  });

  describe("exportAllResultsAsCsv", () => {
    it("appends one CSV entry per asset type with a row for each timestep", async () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .aJunction(IDS.J2)
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build();

      const step0 = createMockResultsReader({
        junctions: {
          [IDS.J1]: { pressure: 10 },
          [IDS.J2]: { pressure: 11 },
        },
        pipes: { [IDS.P1]: { flow: 1 } },
      });
      const step1 = createMockResultsReader({
        junctions: {
          [IDS.J1]: { pressure: 20 },
          [IDS.J2]: { pressure: 21 },
        },
        pipes: { [IDS.P1]: { flow: 2 } },
      });

      const simulation = {
        status: "success",
        report: "",
        modelVersion: hydraulicModel.version,
        settingsVersion: "",
        epsResultsReader: {
          timestepCount: 2,
          reportingTimeStep: 3600,
          getResultsForTimestep: (step: number) =>
            Promise.resolve(step === 0 ? step0 : step1),
        },
      } as unknown as SimulationState;

      const store = setInitialState({
        hydraulicModel,
        simulation,
        simulationStep: 0,
      });
      renderComponent({
        store,
        options: {
          format: "geojson",
          includeSimulationResults: false,
          exportAllResultsAsCsv: true,
        },
      });

      await triggerExport({
        format: "geojson",
        includeSimulationResults: false,
        exportAllResultsAsCsv: true,
      });

      const [, files] = vi.mocked(Export.exportFile).mock.calls[0];
      const csvEntries = files.filter((f) => f.format === "csv");

      expect(csvEntries).toHaveLength(6);
      expectFilesToBePresent(csvEntries, [
        "sim_junction",
        "sim_tank",
        "sim_reservoir",
        "sim_pipe",
        "sim_pump",
        "sim_valve",
      ]);

      const junctionRows = csvEntries[0].data as Record<string, unknown>[];
      expect(junctionRows).toHaveLength(4); // 2 junctions × 2 timesteps
      expect(junctionRows[0]).toMatchObject({
        timestep: "00:00",
        sim_pressure: 10,
      });
      expect(junctionRows[1]).toMatchObject({
        timestep: "00:00",
        sim_pressure: 11,
      });
      expect(junctionRows[2]).toMatchObject({
        timestep: "01:00",
        sim_pressure: 20,
      });
      expect(junctionRows[3]).toMatchObject({
        timestep: "01:00",
        sim_pressure: 21,
      });

      const pipeRows = csvEntries[3].data as Record<string, unknown>[];
      expect(pipeRows).toHaveLength(2); // 1 pipe × 2 timesteps
      expect(pipeRows[0]).toMatchObject({ timestep: "00:00", sim_flow: 1 });
      expect(pipeRows[1]).toMatchObject({ timestep: "01:00", sim_flow: 2 });
    });
  });

  describe("with simulation results", () => {
    it("appends sim_ properties to each asset when simulation exists", async () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .aJunction(IDS.J2)
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build();
      const simulationResults = createMockResultsReader({
        junctions: {
          [IDS.J1]: { pressure: 42, head: 10, demand: 5 },
          [IDS.J2]: { pressure: 30, head: 8, demand: 3 },
        },
        pipes: {
          [IDS.P1]: { flow: 1.5, velocity: 0.8, headloss: 2.1 },
        },
      });

      const store = setInitialState({ hydraulicModel, simulationResults });
      renderComponent({
        store,
        options: { format: "geojson", includeSimulationResults: true },
      });

      await triggerExport({
        format: "geojson",
        includeSimulationResults: true,
      });

      const [, files] = vi.mocked(Export.exportFile).mock.calls[0];

      const junctionsData = files[0].data as Record<string, unknown>[];
      const junction = junctionsData.find((f) => f.id === IDS.J1);
      expect(junction).toMatchObject({
        sim_pressure: 42,
        sim_head: 10,
        sim_demand: 5,
      });

      const pipesData = files[3].data as Record<string, unknown>[];
      const pipe = pipesData.find((f) => f.id === IDS.P1);
      expect(pipe).toMatchObject({
        sim_flow: 1.5,
        sim_velocity: 0.8,
        sim_headloss: 2.1,
      });
    });
  });

  const triggerExport = async (options: DataExportOptions) => {
    const button = screen.getByRole("button", {
      name: `export-${options.format}-${options.includeSimulationResults}`,
    });
    await userEvent.click(button);
  };

  const TestableComponent = ({ options }: { options: DataExportOptions }) => {
    const exportData = useExportData();
    return (
      <button
        aria-label={`export-${options.format}-${options.includeSimulationResults}`}
        onClick={() => exportData(options)}
      >
        Export
      </button>
    );
  };

  const renderComponent = ({
    store,
    options = { format: "geojson", includeSimulationResults: false },
  }: {
    store: Store;
    options?: DataExportOptions;
  }) => {
    render(
      <CommandContainer store={store}>
        <TestableComponent options={options} />
      </CommandContainer>,
    );
  };
});

const expectFilesToBePresent = (files: ExportEntry[], names: string[]) => {
  names.forEach((name, i) => {
    expect(files[i].name).toEqual(name);
  });
};
