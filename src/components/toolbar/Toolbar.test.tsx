import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { Toolbar } from "./Toolbar";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "react-query";

describe("Toolbar", () => {
  it("displays button to create new project", () => {
    renderComponent();

    userEvent.click(screen.getByRole("button", { name: /New/ }));
  });

  it("displays option to open inp", () => {
    renderComponent();

    userEvent.click(screen.getByRole("button", { name: /Open/ }));
  });

  it("displays option to export", () => {
    renderComponent();

    userEvent.click(screen.getByRole("button", { name: /Export/ }));
  });

  const renderComponent = () => {
    const queryClient = new QueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toolbar />
        </TooltipProvider>
      </QueryClientProvider>,
    );
  };
});
