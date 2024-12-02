import { render, screen } from "@testing-library/react";
import { SimulationButton } from "./SimulationButton";
import { TooltipProvider } from "@radix-ui/react-tooltip";

describe.skip("Simulation button", () => {
  it("displays", () => {
    renderComponent();

    expect(
      screen.getByRole("button", { name: "Simulate" }),
    ).toBeInTheDocument();
  });

  const renderComponent = () => {
    return render(
      <TooltipProvider>
        <SimulationButton />
      </TooltipProvider>,
    );
  };
});
