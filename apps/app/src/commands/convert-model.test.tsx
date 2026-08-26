import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyNetworkData, type NetworkData } from "@epanet-js/converters";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { aTestFile } from "src/__helpers__/file";
import { setInitialState } from "src/__helpers__/state";
import { stubFileOpen } from "src/__helpers__/browser-fs-mock";
import { fileOpen } from "browser-fs-access";
import { stubProjectionsReady } from "src/__helpers__/projections";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { getByLabel } from "src/__helpers__/asset-queries";
import { waitForNotLoading } from "src/__helpers__/ui-expects";
import { stubConverter } from "src/lib/converters/__helpers__/stub-converter";
import { registerConverter } from "src/lib/converters";
import { fetchProject } from "src/lib/db";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import {
  simulationSettingsDerivedAtom,
  stagingModelDerivedAtom,
} from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";
import { zonesAtom } from "src/state/zones";
import { Store } from "src/state";
import { Junction, Pipe, Reservoir, Tank, Valve } from "src/hydraulic-model";
import { CommandContainer } from "./__helpers__/command-container";
import { useConvertModel } from "./convert-model";

describe("convertModel", () => {
  useInProcessDb();

  beforeEach(() => {
    stubProjectionsReady();
  });

  it("builds the model the converter parsed", async () => {
    stubFileOpen();
    stubConverter("synergi", {
      network: aNetwork({
        junctions: [
          { ref: "1", label: "J1", coordinates: [1113194.9, 0], elevation: 63 },
        ],
        reservoirs: [{ ref: "2", label: "R1", coordinates: [0, 0], head: 100 }],
        tanks: [
          {
            ref: "3",
            label: "T1",
            coordinates: [0, 0],
            elevation: 77,
            initialLevel: 10,
          },
        ],
        pipes: [
          {
            ref: "10",
            label: "P1",
            startNodeRef: "1",
            endNodeRef: "3",
            length: 250,
          },
        ],
        valves: [
          {
            ref: "11",
            label: "V1",
            startNodeRef: "1",
            endNodeRef: "2",
            kind: "unknown",
          },
        ],
        crs: { type: "epsg", code: 3857 },
        units: { flow: "l/s", elevation: "m", level: "m", length: "m" },
      }),
      issues: [],
    });
    const store = setInitialState();

    renderComponent({ store });
    await triggerCommand();
    await doFileSelection(aTestFile({ filename: "my-network.mdb" }));

    await waitForNotLoading();

    const hydraulicModel = store.get(stagingModelDerivedAtom);
    const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
    expect(junction.elevation).toEqual(63);
    expect(junction.coordinates[0]).toBeCloseTo(10, 5);

    const reservoir = getByLabel(hydraulicModel.assets, "R1") as Reservoir;
    expect(reservoir.head).toEqual(100);

    const tank = getByLabel(hydraulicModel.assets, "T1") as Tank;
    expect(tank.elevation).toEqual(77);
    expect(tank.initialLevel).toEqual(10);

    const pipe = getByLabel(hydraulicModel.assets, "P1") as Pipe;
    expect(pipe.length).toEqual(250);
    expect(hydraulicModel.topology.getNodes(pipe.id)).toEqual([
      junction.id,
      tank.id,
    ]);

    const valve = getByLabel(hydraulicModel.assets, "V1") as Valve;
    expect(valve.kind).toEqual("tcv");
    expect(hydraulicModel.topology.getNodes(valve.id)).toEqual([
      junction.id,
      reservoir.id,
    ]);

    const projectSettings = store.get(projectSettingsAtom);
    expect(projectSettings.name).toEqual("my-network");
    expect(projectSettings.projection.id).toEqual("EPSG:3857");
    expect(projectSettings.units.flow).toEqual("l/s");
  });

  it("opens the project with the zones the converter parsed", async () => {
    stubFileOpen();
    stubConverter("synergi", {
      network: aNetwork({
        zones: [
          {
            ref: "3",
            label: "BLBULLMA",
            polygons: [
              [
                [
                  [0, 0],
                  [10, 0],
                  [10, 10],
                  [0, 0],
                ],
              ],
            ],
          },
        ],
      }),
      issues: [],
    });
    const store = setInitialState();

    renderComponent({ store });
    await triggerCommand();
    await doFileSelection(aTestFile({ filename: "my-network.mdb" }));

    await waitForNotLoading();

    const zones = [...store.get(zonesAtom).values()];
    expect(zones.map((zone) => zone.label)).toEqual(["BLBULLMA"]);
    expect(zones[0].geometry.type).toEqual("MultiPolygon");

    const saved = await fetchProject();
    expect([...saved.zones.values()].map((zone) => zone.label)).toEqual([
      "BLBULLMA",
    ]);
  });

  it("runs an extended period matching the source's own timing", async () => {
    stubFileOpen();
    stubConverter("synergi", {
      network: aNetwork({ patternTimeStep: 900, simulationDuration: 86400 }),
      issues: [],
    });
    const store = setInitialState();

    renderComponent({ store });
    await triggerCommand();
    await doFileSelection(aTestFile({ filename: "my-network.mdb" }));
    await waitForNotLoading();

    const { timing } = store.get(simulationSettingsDerivedAtom);
    expect(timing.duration).toEqual(86400);
    expect(timing.patternTimestep).toEqual(900);
    expect(timing.hydraulicTimestep).toEqual(900);
    expect(timing.reportTimestep).toEqual(900);
  });

  it("stays on the defaults when the source states no timing", async () => {
    stubFileOpen();
    stubConverter("synergi", { network: aNetwork(), issues: [] });
    const store = setInitialState();

    renderComponent({ store });
    await triggerCommand();
    await doFileSelection(aTestFile({ filename: "my-network.mdb" }));
    await waitForNotLoading();

    expect(store.get(simulationSettingsDerivedAtom).timing.duration).toEqual(0);
  });

  it("captures user tracking events", async () => {
    const userTracking = stubUserTracking();
    stubFileOpen();
    stubConverter("synergi", { network: aNetwork(), issues: [] });
    const store = setInitialState();

    renderComponent({ store });
    await triggerCommand();
    await doFileSelection(aTestFile({ filename: "my-network.mdb" }));

    await waitForNotLoading();

    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "convertModel.started",
      source: "toolbar",
      vendor: "synergi",
    });
    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "convertModel.completed",
      source: "toolbar",
      vendor: "synergi",
      counts: {
        junctions: 0,
        reservoirs: 0,
        tanks: 0,
        pipes: 0,
        pumps: 0,
        valves: 0,
        zones: 0,
      },
      issues: [],
    });
  });

  it("does not import when the converter reports an error", async () => {
    const userTracking = stubUserTracking();
    stubFileOpen();
    stubConverter("synergi", {
      network: emptyNetworkData(),
      issues: [{ code: "modelFileUnreadable", severity: "error" }],
    });
    const previousModel = HydraulicModelBuilder.empty();
    const store = setInitialState({ hydraulicModel: previousModel });

    renderComponent({ store });
    await triggerCommand();
    await doFileSelection(aTestFile({ filename: "my-network.mdb" }));

    await waitForNotLoading();

    expect(screen.getByText(/could not be opened/i)).toBeInTheDocument();
    expect(store.get(stagingModelDerivedAtom)).toBe(previousModel);
    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "convertModel.failed",
      source: "toolbar",
      vendor: "synergi",
      issues: ["modelFileUnreadable"],
    });
    expect(userTracking.capture).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: "convertModel.completed" }),
    );
  });

  it("imports and reports the warnings the converter found", async () => {
    const userTracking = stubUserTracking();
    stubFileOpen();
    stubConverter("synergi", {
      network: aNetwork({
        junctions: [{ ref: "1", label: "J1", coordinates: [0, 0] }],
      }),
      issues: [
        { code: "nodeCoordinatesMissing", severity: "warning", ref: "7" },
        { code: "coordinateSystemMissing", severity: "warning" },
      ],
    });
    const store = setInitialState();

    renderComponent({ store });
    await triggerCommand();
    await doFileSelection(aTestFile({ filename: "my-network.mdb" }));

    await waitForNotLoading();

    expect(screen.getByText(/partially imported model/i)).toBeInTheDocument();

    const hydraulicModel = store.get(stagingModelDerivedAtom);
    expect(getByLabel(hydraulicModel.assets, "J1")).toBeDefined();

    expect(userTracking.capture).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "convertModel.completed",
        issues: ["nodeCoordinatesMissing", "coordinateSystemMissing"],
      }),
    );
  });

  it("shows no dialog when the converter reports nothing", async () => {
    stubFileOpen();
    stubConverter("synergi", { network: aNetwork(), issues: [] });
    const store = setInitialState();

    renderComponent({ store });
    await triggerCommand();
    await doFileSelection(aTestFile({ filename: "my-network.mdb" }));

    await waitForNotLoading();

    expect(screen.queryByText(/partially imported model/i)).toBeNull();
  });

  it("opens the file picker the converter asks for", async () => {
    stubFileOpen();
    stubConverter(
      "synergi",
      { network: aNetwork(), issues: [] },
      { name: "Vendor X", extensions: [".vx"] },
    );
    const store = setInitialState();

    renderComponent({ store });
    await triggerCommand();
    await doFileSelection(aTestFile({ filename: "my-network.vx" }));

    await waitForNotLoading();

    expect(fileOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        extensions: [".vx"],
        description: "Vendor X",
      }),
    );
  });

  it("keeps the previous model and reports when the file cannot be read", async () => {
    stubFileOpen();
    registerConverter("synergi", {
      name: "Synergi",
      extensions: [".mdb"],
      parseNetworkData: () => Promise.reject(new Error("cannot read")),
    });
    const previousModel = HydraulicModelBuilder.empty();
    const store = setInitialState({ hydraulicModel: previousModel });

    renderComponent({ store });
    await triggerCommand();
    await doFileSelection(aTestFile({ filename: "my-network.mdb" }));

    await waitForNotLoading();

    expect(screen.getByText(/failed to open model/i)).toBeInTheDocument();
    expect(store.get(stagingModelDerivedAtom)).toBe(previousModel);
  });
});

const triggerCommand = async () => {
  await userEvent.click(screen.getByRole("button", { name: "convertModel" }));
};

const doFileSelection = async (file: File) => {
  await userEvent.upload(screen.getByTestId("file-upload"), file);
};

const aNetwork = (data: Partial<NetworkData> = {}): NetworkData => ({
  junctions: [],
  reservoirs: [],
  tanks: [],
  pipes: [],
  pumps: [],
  valves: [],
  curves: [],
  patterns: [],
  controls: [],
  zones: [],
  units: {},
  crs: { type: "unknown" },
  ...data,
});

const TestableComponent = () => {
  const convertModel = useConvertModel();

  return (
    <button
      aria-label="convertModel"
      onClick={() => convertModel({ vendor: "synergi", source: "toolbar" })}
    >
      Convert model
    </button>
  );
};

const renderComponent = ({ store }: { store: Store }) => {
  render(
    <CommandContainer store={store}>
      <TestableComponent />
    </CommandContainer>,
  );
};
