import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NetworkData } from "@epanet-js/converters";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { aTestFile } from "src/__helpers__/file";
import { setInitialState } from "src/__helpers__/state";
import { stubFileOpen } from "src/__helpers__/browser-fs-mock";
import { stubProjectionsReady } from "src/__helpers__/projections";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { getByLabel } from "src/__helpers__/asset-queries";
import { waitForNotLoading } from "src/__helpers__/ui-expects";
import { stubConverter } from "src/lib/converters/__helpers__/stub-converter";
import { registerConverter } from "src/lib/converters";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";
import { Store } from "src/state";
import { Junction, Pipe, Reservoir, Tank, Valve } from "src/hydraulic-model";
import { CommandContainer } from "./__helpers__/command-container";
import { useOpenSynergi } from "./open-synergi";

describe("openSynergi", () => {
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
      name: "importSynergi.started",
      source: "toolbar",
    });
    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "importSynergi.completed",
      source: "toolbar",
      counts: {
        junctions: 0,
        reservoirs: 0,
        tanks: 0,
        pipes: 0,
        pumps: 0,
        valves: 0,
      },
    });
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
  await userEvent.click(screen.getByRole("button", { name: "openSynergi" }));
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
  units: {},
  crs: { type: "unknown" },
  ...data,
});

const TestableComponent = () => {
  const openSynergi = useOpenSynergi();

  return (
    <button
      aria-label="openSynergi"
      onClick={() => openSynergi({ source: "toolbar" })}
    >
      Open Synergi
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
