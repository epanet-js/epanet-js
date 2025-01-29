import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { Toolbar } from "./Toolbar";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { UIDMap } from "src/lib/id_mapper";
import { PersistenceContext } from "src/lib/persistence/context";
import { MemPersistence } from "src/lib/persistence/memory";

describe("Toolbar", () => {
  it("displays button to create new project", () => {
    renderComponent();

    userEvent.click(screen.getByRole("button", { name: /New/ }));
  });

  it("displays option to open inp", () => {
    renderComponent();

    userEvent.click(screen.getByRole("button", { name: /Open/ }));
  });

  it("displays option to save", () => {
    renderComponent();

    userEvent.click(screen.getByRole("button", { name: "Save" }));
  });

  it("displays option to save as ", () => {
    renderComponent();

    userEvent.click(screen.getByRole("button", { name: /Save as/ }));
  });

  it("displays option to undo", () => {
    renderComponent();

    userEvent.click(screen.getByRole("button", { name: /Undo/ }));
  });

  it("displays option to redo", () => {
    renderComponent();

    userEvent.click(screen.getByRole("button", { name: /Redo/ }));
  });

  const renderComponent = () => {
    const idMap = UIDMap.empty();
    const queryClient = new QueryClient();
    const store = createStore();
    return render(
      <JotaiProvider store={store}>
        <PersistenceContext.Provider value={new MemPersistence(idMap, store)}>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <Toolbar />
            </TooltipProvider>
          </QueryClientProvider>
        </PersistenceContext.Provider>
      </JotaiProvider>,
    );
  };
});
