import { fireEvent, render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, atom } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@epanet-js/ui-kit";
import { setInitialState } from "src/__helpers__/state";
import { Store } from "src/state";
import { Mode } from "src/state/mode";
import { PolygonalSelectionIcon } from "src/icons";
import { ToolWithOptions } from "./tool-with-options";

describe("ToolWithOptions", () => {
  it("cycles the mode when pressed and released", () => {
    const cycleMode = vi.fn(() => Mode.SELECT_POLYGONAL);
    renderComponent(cycleMode);

    const button = screen.getByRole("radio");
    fireEvent.pointerDown(button);
    fireEvent.pointerUp(button);

    expect(cycleMode).toHaveBeenCalledTimes(1);
  });

  it("ignores a release that did not start on the button", () => {
    const cycleMode = vi.fn(() => Mode.SELECT_POLYGONAL);
    renderComponent(cycleMode);

    fireEvent.pointerUp(screen.getByRole("radio"));

    expect(cycleMode).not.toHaveBeenCalled();
  });

  it("ignores a press that was dragged off the button", () => {
    const cycleMode = vi.fn(() => Mode.SELECT_POLYGONAL);
    renderComponent(cycleMode);

    const button = screen.getByRole("radio");
    fireEvent.pointerDown(button);
    fireEvent.pointerLeave(button);
    fireEvent.pointerUp(button);

    expect(cycleMode).not.toHaveBeenCalled();
  });

  it("does not cycle the mode when disabled", () => {
    const cycleMode = vi.fn(() => Mode.SELECT_POLYGONAL);
    renderComponent(cycleMode, true);

    const button = screen.getByRole("radio");
    fireEvent.pointerDown(button);
    fireEvent.pointerUp(button);

    expect(cycleMode).not.toHaveBeenCalled();
  });

  const renderComponent = (cycleMode: () => Mode, disabled = false) => {
    const store: Store = setInitialState({ mode: Mode.NONE });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <JotaiProvider store={store}>
          <TooltipProvider>
            <ToolWithOptions
              label="Tool"
              shortcut="s"
              lastModeAtom={atom<Mode>(Mode.SELECT_POLYGONAL)}
              cycleMode={cycleMode}
              disabled={disabled}
              options={[
                {
                  mode: Mode.SELECT_POLYGONAL,
                  label: "Polygonal",
                  Icon: PolygonalSelectionIcon,
                },
              ]}
            />
          </TooltipProvider>
        </JotaiProvider>
      </QueryClientProvider>,
    );
  };
});
