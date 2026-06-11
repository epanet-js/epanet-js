import { render, screen } from "@testing-library/react";
import {
  SelectorPortalContainer,
  useSelectorPortalContainer,
} from "./selector-portal-container";

function Probe() {
  const container = useSelectorPortalContainer();
  return <div>{container ? container.id : "no-container"}</div>;
}

describe("useSelectorPortalContainer", () => {
  it("returns null when no SelectorPortalContainer is mounted", () => {
    render(<Probe />);
    expect(screen.getByText("no-container")).toBeInTheDocument();
  });

  it("returns the provided container element", () => {
    const el = document.createElement("div");
    el.id = "portal-target";
    render(
      <SelectorPortalContainer container={el}>
        <Probe />
      </SelectorPortalContainer>,
    );
    expect(screen.getByText("portal-target")).toBeInTheDocument();
  });
});
