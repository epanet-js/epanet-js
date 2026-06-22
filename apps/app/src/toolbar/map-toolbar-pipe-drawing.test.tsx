import { render, screen } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import userEvent from "@testing-library/user-event";
import { setInitialState } from "src/__helpers__/state";
import { stubFeatureOn, stubFeatureOff } from "src/__helpers__/feature-flags";
import { Store } from "src/state";
import { Mode } from "src/state/mode";
import { pipeDrawingDefaultsAtom } from "src/state/drawing";
import { MapToolbarPipeDrawing } from "./map-toolbar-pipe-drawing";

describe("MapToolbarPipeDrawing", () => {
  beforeEach(() => {
    stubFeatureOff("FLAG_NULL_VALUES");
  });

  it("clears the roughness default to empty when null values are enabled", async () => {
    stubFeatureOn("FLAG_NULL_VALUES");
    const store = setInitialState({ mode: Mode.DRAW_PIPE });
    const user = userEvent.setup();

    renderComponent(store);

    const field = screen.getByRole("textbox", {
      name: /value for: roughness/i,
    });
    await user.clear(field);
    await user.keyboard("{Enter}");

    expect(store.get(pipeDrawingDefaultsAtom).roughness).toBeNull();
  });

  it("keeps a default roughness when null values are disabled", async () => {
    stubFeatureOff("FLAG_NULL_VALUES");
    const store = setInitialState({ mode: Mode.DRAW_PIPE });
    const user = userEvent.setup();

    renderComponent(store);

    const field = screen.getByRole("textbox", {
      name: /value for: roughness/i,
    });
    await user.clear(field);
    await user.keyboard("{Enter}");

    expect(store.get(pipeDrawingDefaultsAtom).roughness).toBeUndefined();
  });

  const renderComponent = (store: Store) => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <JotaiProvider store={store}>
          <TooltipProvider>
            <MapToolbarPipeDrawing />
          </TooltipProvider>
        </JotaiProvider>
      </QueryClientProvider>,
    );
  };
});
