import { screen, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { CommandContainer } from "./__helpers__/command-container";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Export } from "src/lib/export";
import { Store } from "src/state";
import { useExportData, DataExportOptions } from "./export-data";
import { Junction, Pipe } from "src/hydraulic-model";

describe("export-data", () => {
  beforeEach(() => {
    vi.spyOn(Export, "exportFile").mockReturnValue(new Blob());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("geojson format", () => {
    it("exports all model assets in a single file", async () => {
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

      const [format, files] = vi.mocked(Export.exportFile).mock.calls[0];
      expect(format).toBe("geojson");

      const data = files[0].data as { id: number }[];
      expect(data).toHaveLength(3);
      expect(data.map((f) => f.id)).toEqual(
        expect.arrayContaining([IDS.J1, IDS.J2, IDS.P1]),
      );
    });

    it("includes the asset geometry in each entry", async () => {
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
      const data = files[0].data as {
        id: number;
        geometry: { type: string };
      }[];

      const junction = data.find((f) => f.id === IDS.J1);
      expect(junction?.geometry.type).toEqual("Point");

      const pipe = data.find((f) => f.id === IDS.P1);
      expect(pipe?.geometry.type).toEqual("LineString");
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
      const features = files[0].data as Record<string, unknown>[];

      const junction = features.find((f) => f.id === IDS.J1);

      expect(junction).toMatchObject({
        id: IDS.J1,
        type: "junction",
        label: hydraulicModel.assets.get(IDS.J1)?.label,
        isActive: hydraulicModel.assets.get(IDS.J1)?.isActive,
        elevation: (hydraulicModel.assets.get(IDS.J1) as Junction)?.elevation,
        emitterCoefficient: (hydraulicModel.assets.get(IDS.J1) as Junction)
          ?.emitterCoefficient,
      });

      const pipe = features.find((f) => f.id === IDS.P1);
      expect(pipe).toMatchObject({
        id: IDS.P1,
        type: "pipe",
        label: hydraulicModel.assets.get(IDS.P1)?.label,
        diameter: (hydraulicModel.assets.get(IDS.P1) as Pipe)?.diameter,
        roughness: (hydraulicModel.assets.get(IDS.P1) as Pipe)?.roughness,
        length: (hydraulicModel.assets.get(IDS.P1) as Pipe)?.length,
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
