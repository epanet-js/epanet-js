import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import * as db from "src/lib/db";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { defaultProjectSettings } from "@epanet-js/project-settings";
import type { HydraulicModel } from "src/hydraulic-model";
import { Store } from "src/state";
import { projectFileInfoAtom, isDemoNetworkAtom } from "src/state/file-system";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { getByLabel } from "src/__helpers__/asset-queries";
import { useOpenDemoNetwork } from "./open-demo-network";

describe("open demo network", () => {
  useInProcessDb();

  it("initializes state opening a demo project from a url", async () => {
    const IDS = { J1: 1 } as const;
    const blob = await buildProjectBlob(
      HydraulicModelBuilder.with().aJunction(IDS.J1, { label: "J1" }).build(),
    );
    stubResponseOk(blob);
    const url = "http://example.org/01-uk-style.ejsdb";
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.empty(),
    });
    renderComponent({ store, url });

    await triggerOpenDemoNetwork();

    const hydraulicModel = store.get(stagingModelDerivedAtom);
    expect(getByLabel(hydraulicModel.assets, "J1")).toBeTruthy();

    const fileInfo = store.get(projectFileInfoAtom);
    expect(fileInfo!.name).toEqual("01-uk-style.ejsdb");
    expect(store.get(isDemoNetworkAtom)).toBe(true);
  });

  it("ignores parameters from the url", async () => {
    const IDS = { J1: 1 } as const;
    const blob = await buildProjectBlob(
      HydraulicModelBuilder.with().aJunction(IDS.J1, { label: "J1" }).build(),
    );
    stubResponseOk(blob);
    const url = "http://example.org/01-uk-style.ejsdb?key=1&other=2";
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.empty(),
    });
    renderComponent({ store, url });

    await triggerOpenDemoNetwork();

    const fileInfo = store.get(projectFileInfoAtom);
    expect(fileInfo!.name).toEqual("01-uk-style.ejsdb");
  });

  const buildProjectBlob = async (hydraulicModel: HydraulicModel) => {
    await db.importProject({
      newDb: true,
      hydraulicModel,
      projectSettings: defaultProjectSettings,
      simulationSettings: defaultSimulationSettings,
    });
    return db.exportDb();
  };

  const triggerOpenDemoNetwork = async () => {
    await userEvent.click(
      screen.getByRole("button", { name: "openDemoNetwork" }),
    );
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.queryByText(/opening project/i)).not.toBeInTheDocument();
    });
  };

  const TestableComponent = ({ url }: { url: string }) => {
    const { openDemoNetwork } = useOpenDemoNetwork();

    return (
      <button
        aria-label="openDemoNetwork"
        onClick={() => void openDemoNetwork(url)}
      >
        Open
      </button>
    );
  };

  const stubResponseOk = (data: Blob) => {
    window.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(data),
      } as unknown as Response),
    );
  };

  const renderComponent = ({ store, url }: { store: Store; url: string }) => {
    render(
      <CommandContainer store={store}>
        <TestableComponent url={url} />
      </CommandContainer>,
    );
  };
});
