import { render, screen, waitFor } from "@testing-library/react";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Store, dataAtom, fileInfoAtom } from "src/state/jotai";
import { Junction } from "src/hydraulic-model";
import userEvent from "@testing-library/user-event";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useOpenInpFromUrl } from "./open-inp-from-url";

describe("open inp from url", () => {
  it("initializes state opening an inp from a url", async () => {
    const inp = `
    [JUNCTIONS]
    J1\t10
    `;
    window.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(inp),
      } as unknown as Response),
    );
    const inpUrl = "http://example.org/network-001.inp";
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.empty(),
    });
    renderComponent({ store, inpUrl });

    await triggerOpenInpFromUrl();

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const { hydraulicModel } = store.get(dataAtom);
    const junction = hydraulicModel.assets.get("J1");
    expect((junction as Junction).elevation).toEqual(10);

    const fileInfo = store.get(fileInfoAtom);
    expect(fileInfo!.name).toEqual("network-001.inp");
  });

  it("shows an error if fetch fails", async () => {
    window.fetch = vi.fn().mockRejectedValue(new Error("Booom"));
    const inpUrl = "http://example.org/network-001.inp";
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.empty(),
    });
    renderComponent({ store, inpUrl });

    await triggerOpenInpFromUrl();

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/failed/i)).toBeInTheDocument();

    expect(screen.getByText(/welcome/i)).toBeInTheDocument();

    const fileInfo = store.get(fileInfoAtom);
    expect(fileInfo).toBeNull();
  });

  const triggerOpenInpFromUrl = async () => {
    await userEvent.click(
      screen.getByRole("button", { name: "openInpFromUrl" }),
    );
  };

  const TestableComponent = ({ inpUrl }: { inpUrl: string }) => {
    const { openInpFromUrl } = useOpenInpFromUrl();

    return (
      <button
        aria-label="openInpFromUrl"
        onClick={() => openInpFromUrl(inpUrl)}
      >
        Open
      </button>
    );
  };

  const renderComponent = ({
    store,
    inpUrl,
  }: {
    store: Store;
    inpUrl: string;
  }) => {
    render(
      <CommandContainer store={store}>
        <TestableComponent inpUrl={inpUrl} />
      </CommandContainer>,
    );
  };
});
