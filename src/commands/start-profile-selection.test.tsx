import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Mode, modeAtom } from "src/state/mode";
import { Store } from "src/state";
import { hglProfileAtom } from "src/state/hgl-profile";
import { ephemeralStateAtom } from "src/state/drawing";
import { selectionAtom } from "src/state/selection";
import {
  aMultiSelection,
  createMockResultsReader,
  setInitialState,
} from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useStartProfileSelection } from "./start-profile-selection";

describe("useStartProfileSelection", () => {
  it("enters hgl-profile mode when simulation results are available", async () => {
    const store = setInitialState({
      simulationResults: createMockResultsReader(),
    });

    renderComponent({ store });

    await userEvent.click(screen.getByRole("button", { name: "start" }));

    expect(store.get(modeAtom).mode).toBe(Mode.HGL_PROFILE);
  });

  it("enters hgl-profile mode even when no simulation has run", async () => {
    const store = setInitialState({});

    renderComponent({ store });

    await userEvent.click(screen.getByRole("button", { name: "start" }));

    expect(store.get(modeAtom).mode).toBe(Mode.HGL_PROFILE);
  });

  it("resets a committed profile and staged anchors while keeping selection", async () => {
    const previousSelection = aMultiSelection({ ids: [1, 2, 3] });
    const store = setInitialState({
      mode: Mode.HGL_PROFILE,
      selection: previousSelection,
    });
    store.set(hglProfileAtom, {
      id: "previous",
      anchors: [1, 3],
      terrain: null,
      isUnprojected: false,
    });
    store.set(ephemeralStateAtom, {
      type: "hglProfile",
      anchorIds: [1],
    });

    renderComponent({ store });

    await userEvent.click(screen.getByRole("button", { name: "start" }));

    expect(store.get(hglProfileAtom)).toBeNull();
    const ephemeral = store.get(ephemeralStateAtom);
    expect(ephemeral.type).toBe("hglProfile");
    expect(
      ephemeral.type === "hglProfile" ? ephemeral.anchorIds : null,
    ).toBeUndefined();
    expect(store.get(modeAtom).mode).toBe(Mode.HGL_PROFILE);
    expect(store.get(selectionAtom)).toEqual(previousSelection);
  });

  const TestableComponent = () => {
    const start = useStartProfileSelection();

    return (
      <button aria-label="start" onClick={() => start({ source: "toolbar" })}>
        Start
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
});
