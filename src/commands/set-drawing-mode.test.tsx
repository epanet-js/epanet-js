import { Store, modeAtom, selectionAtom } from "src/state/jotai";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aSingleSelection, setInitialState } from "src/__helpers__/state";
import { useDrawingMode } from "./set-drawing-mode";
import { Mode } from "src/state/mode";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { CommandContainer } from "./__helpers__/command-container";

const TestComponent = () => {
  const setDrawingMode = useDrawingMode();

  return (
    <div>
      <button
        data-testid="set-none-mode"
        onClick={() => setDrawingMode(Mode.NONE)}
      >
        Set None Mode
      </button>
      <button
        data-testid="set-pipe-mode"
        onClick={() => setDrawingMode(Mode.DRAW_PIPE)}
      >
        Set Pipe Mode
      </button>
      <button
        data-testid="set-rectangular-mode"
        onClick={() => setDrawingMode(Mode.SELECT_RECTANGULAR)}
      >
        Set Rectangular Mode
      </button>
      <button
        data-testid="set-polygonal-mode"
        onClick={() => setDrawingMode(Mode.SELECT_POLYGONAL)}
      >
        Set Polygonal Mode
      </button>
    </div>
  );
};

const renderComponent = ({ store }: { store: Store }) => {
  return render(
    <CommandContainer store={store}>
      <TestComponent />
    </CommandContainer>,
  );
};

describe("useDrawingMode", () => {
  it("clears selection when changing from drawing mode to none mode", async () => {
    const IDS = { J1: 1 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .build();
    const selection = aSingleSelection({ id: IDS.J1 });
    const store = setInitialState({
      hydraulicModel,
      selection,
      mode: Mode.DRAW_JUNCTION,
    });

    renderComponent({ store });
    const user = userEvent.setup();

    await user.click(await screen.findByTestId("set-none-mode"));

    const updatedSelection = store.get(selectionAtom);
    expect(updatedSelection.type).toEqual("none");

    const updatedMode = store.get(modeAtom);
    expect(updatedMode.mode).toEqual(Mode.NONE);
  });

  it("clears selection when changing to another drawing mode", async () => {
    const IDS = { J1: 1 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .build();
    const selection = aSingleSelection({ id: IDS.J1 });
    const store = setInitialState({
      hydraulicModel,
      selection,
      mode: Mode.DRAW_JUNCTION,
    });

    renderComponent({ store });
    const user = userEvent.setup();

    await user.click(await screen.findByTestId("set-pipe-mode"));

    const updatedSelection = store.get(selectionAtom);
    expect(updatedSelection.type).toEqual("none");

    const updatedMode = store.get(modeAtom);
    expect(updatedMode.mode).toEqual(Mode.DRAW_PIPE);
  });

  it("preserves selection when switching between selection modes", async () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .build();
    const selection = aSingleSelection({ id: IDS.J1 });
    const store = setInitialState({
      hydraulicModel,
      selection,
      mode: Mode.SELECT_RECTANGULAR,
    });

    renderComponent({ store });
    const user = userEvent.setup();

    await user.click(await screen.findByTestId("set-polygonal-mode"));

    const updatedSelection = store.get(selectionAtom);
    expect(updatedSelection).toEqual(selection);

    const updatedMode = store.get(modeAtom);
    expect(updatedMode.mode).toEqual(Mode.SELECT_POLYGONAL);
  });

  it("preserves selection when switching from none mode to area selection mode", async () => {
    const IDS = { J1: 1 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .build();
    const selection = aSingleSelection({ id: IDS.J1 });
    const store = setInitialState({
      hydraulicModel,
      selection,
      mode: Mode.NONE,
    });

    renderComponent({ store });
    const user = userEvent.setup();

    await user.click(await screen.findByTestId("set-rectangular-mode"));

    const updatedSelection = store.get(selectionAtom);
    expect(updatedSelection).toEqual(selection);

    const updatedMode = store.get(modeAtom);
    expect(updatedMode.mode).toEqual(Mode.SELECT_RECTANGULAR);
  });

  it("clears selection when switching from area selection mode to drawing mode", async () => {
    const IDS = { J1: 1 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .build();
    const selection = aSingleSelection({ id: IDS.J1 });
    const store = setInitialState({
      hydraulicModel,
      selection,
      mode: Mode.SELECT_RECTANGULAR,
    });

    renderComponent({ store });
    const user = userEvent.setup();

    await user.click(await screen.findByTestId("set-pipe-mode"));

    const updatedSelection = store.get(selectionAtom);
    expect(updatedSelection.type).toEqual("none");

    const updatedMode = store.get(modeAtom);
    expect(updatedMode.mode).toEqual(Mode.DRAW_PIPE);
  });
});
