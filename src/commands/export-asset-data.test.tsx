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
import { useExportAssetData, DataExportOptions } from "./export-asset-data";
import { Junction } from "src/hydraulic-model";
import { ExportEntry } from "src/lib/export/types";

describe("export-asset-data", () => {
  beforeEach(() => {
    vi.spyOn(Export, "exportFile").mockResolvedValue(undefined);
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
    const exportAssetData = useExportAssetData();
    return (
      <button
        aria-label={`export-${options.format}-${options.includeSimulationResults}`}
        onClick={() => exportAssetData(options)}
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
