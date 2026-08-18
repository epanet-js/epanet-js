import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import { buildInp } from "src/simulation/build-inp";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { presets } from "@epanet-js/project-settings";
import { WGS84 } from "@epanet-js/projections";
import { Store } from "src/state";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { inpFileInfoAtom } from "src/state/file-system";
import type { RecentFileEntry } from "src/lib/recent-files";
import { useOpenRecentFile } from "./open-recent-file";

describe("open recent file", () => {
  useInProcessDb();

  it("opens a recent INP file", async () => {
    const entry = buildInpEntry();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.empty(),
    });
    renderComponent({ store, entry });

    await userEvent.click(
      screen.getByRole("button", { name: "openRecentFile" }),
    );

    await waitFor(() => {
      const hydraulicModel = store.get(stagingModelDerivedAtom);
      expect(hydraulicModel.assets.size).toBe(3);
    });
    expect(store.get(inpFileInfoAtom)!.name).toEqual("network.inp");
  });

  it("ignores clicks while an open is in flight", async () => {
    const permission = deferred<PermissionState>();
    const entry = buildInpEntry({
      requestPermission: () => permission.promise,
    });
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.empty(),
    });
    renderComponent({ store, entry });

    await userEvent.click(
      screen.getByRole("button", { name: "openRecentFile" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "openRecentFile" }),
    );
    permission.resolve("granted");

    await waitFor(() => {
      const hydraulicModel = store.get(stagingModelDerivedAtom);
      expect(hydraulicModel.assets.size).toBe(3);
    });
    expect(entry.handle.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("allows opening again after a flow completes", async () => {
    const entry = buildInpEntry();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.empty(),
    });
    renderComponent({ store, entry });

    await userEvent.click(
      screen.getByRole("button", { name: "openRecentFile" }),
    );
    await waitFor(() => {
      const hydraulicModel = store.get(stagingModelDerivedAtom);
      expect(hydraulicModel.assets.size).toBe(3);
    });
    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    await userEvent.click(
      screen.getByRole("button", { name: "openRecentFile" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Discard changes" }),
    );

    await waitFor(() => {
      expect(entry.handle.requestPermission).toHaveBeenCalledTimes(2);
    });
  });

  const IDS = { J1: 1, J2: 2, P1: 3 } as const;

  const buildInpContent = () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [10, 20] })
      .aJunction(IDS.J2, { coordinates: [11, 21] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();
    return buildInp(model, {
      simulationSettings: defaultSimulationSettings,
      units: presets.LPS.units,
      headlossFormula: "H-W",
      geolocation: true,
      projection: WGS84,
    });
  };

  const buildInpEntry = ({
    requestPermission,
  }: {
    requestPermission?: () => Promise<PermissionState>;
  } = {}) => {
    const file = new File([buildInpContent()], "network.inp");
    const handle = {
      requestPermission: vi.fn(
        requestPermission ?? (() => Promise.resolve("granted")),
      ),
      getFile: vi.fn(() => Promise.resolve(file)),
      isSameEntry: vi.fn(() => Promise.resolve(true)),
    };
    const entry: RecentFileEntry = {
      id: "recent-1",
      name: "network.inp",
      handle: handle as unknown as FileSystemFileHandle,
      openedAt: Date.now(),
    };
    return entry;
  };

  const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
  };

  const TestableComponent = ({ entry }: { entry: RecentFileEntry }) => {
    const openRecentFile = useOpenRecentFile();

    return (
      <button
        aria-label="openRecentFile"
        onClick={() => openRecentFile(entry, "welcome")}
      >
        Open
      </button>
    );
  };

  const renderComponent = ({
    store,
    entry,
  }: {
    store: Store;
    entry: RecentFileEntry;
  }) => {
    render(
      <CommandContainer store={store}>
        <TestableComponent entry={entry} />
      </CommandContainer>,
    );
  };
});
