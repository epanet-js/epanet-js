import { render, screen } from "@testing-library/react";
import { UIProvider, useUIConfig } from "./ui-provider";

function Probe() {
  const ui = useUIConfig();
  return (
    <ul>
      <li>{ui.searchPlaceholder}</li>
      <li>{ui.selectorAddNewValueTemplate}</li>
      <li>{ui.noResultsLabel}</li>
      <li>{ui.searchingLabel}</li>
    </ul>
  );
}

describe("useUIConfig", () => {
  it("returns the English defaults when no provider is mounted", () => {
    render(<Probe />);
    expect(screen.getByText("Search…")).toBeInTheDocument();
    expect(screen.getByText('Add "{{1}}"')).toBeInTheDocument();
    expect(screen.getByText("No results")).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("merges a partial config over the defaults", () => {
    render(
      <UIProvider config={{ searchPlaceholder: "Buscar" }}>
        <Probe />
      </UIProvider>,
    );
    expect(screen.getByText("Buscar")).toBeInTheDocument();
    expect(screen.getByText("No results")).toBeInTheDocument();
  });
});
