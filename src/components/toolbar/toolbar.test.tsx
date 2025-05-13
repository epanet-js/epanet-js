import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { Toolbar } from "./toolbar";
import { QueryClient, QueryClientProvider } from "react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { UIDMap } from "src/lib/id_mapper";
import { PersistenceContext } from "src/lib/persistence/context";
import { MemPersistence } from "src/lib/persistence/memory";

describe("Toolbar", () => {
  it("displays button to create new project", () => {
    renderComponent();

    expect(screen.getByRole("button", { name: /New/ })).toBeInTheDocument();
  });

  it("displays option to open inp", () => {
    renderComponent();

    expect(screen.getByRole("button", { name: /Open/ })).toBeInTheDocument();
  });

  it("displays option to save", () => {
    renderComponent();

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("displays option to save as ", () => {
    renderComponent();

    expect(screen.getByRole("button", { name: /Save as/ })).toBeInTheDocument();
  });

  it("displays option to undo", () => {
    renderComponent();

    expect(screen.getByRole("button", { name: /Undo/ })).toBeInTheDocument();
  });

  it("displays option to redo", () => {
    renderComponent();

    expect(screen.getByRole("button", { name: /Redo/ })).toBeInTheDocument();
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
