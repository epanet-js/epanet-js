import { render, screen, waitFor } from "@testing-library/react";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Store, fileInfoAtom, stagingModelAtom } from "src/state/jotai";
import userEvent from "@testing-library/user-event";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useOpenInpFromUrl } from "./open-inp-from-url";
import { getByLabel } from "src/__helpers__/asset-queries";

describe("open inp from url", () => {
  it("initializes state opening an inp from a url", async () => {
    const inp = minimalInp({ junctionId: "J1" });
    stubResponseOk(inp);
    const inpUrl = "http://example.org/network-001.inp";
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.empty(),
    });
    renderComponent({ store, inpUrl });

    await triggerOpenInpFromUrl();

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const hydraulicModel = store.get(stagingModelAtom);
    expect(getByLabel(hydraulicModel.assets, "J1")).toBeTruthy();

    const fileInfo = store.get(fileInfoAtom);
    expect(fileInfo!.name).toEqual("network-001.inp");
  });

  it("ignores parameters from the url", async () => {
    const inp = minimalInp({ junctionId: "J1" });
    stubResponseOk(inp);
    const inpUrl = "http://example.org/network-001.inp?key=1&other=2";
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.empty(),
    });
    renderComponent({ store, inpUrl });

    await triggerOpenInpFromUrl();

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const hydraulicModel = store.get(stagingModelAtom);
    expect(getByLabel(hydraulicModel.assets, "J1")).toBeTruthy();

    const fileInfo = store.get(fileInfoAtom);
    expect(fileInfo!.name).toEqual("network-001.inp");
  });

  it.skip("shows an error if fetch fails", async () => {
    const mockCapture = vi.fn();

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

    expect(mockCapture).toHaveBeenCalledWith({
      name: "downloadError.seen",
    });
  });

  const minimalInp = ({
    junctionId = "J1",
  }: {
    junctionId?: string;
  }): string => {
    return `
    [JUNCTIONS]
    ${junctionId}\t10
    [COORDINATES]
    ${junctionId}\t1\t2
    `;
  };

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

  const stubResponseOk = (data: string) => {
    window.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(data),
      } as unknown as Response),
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
