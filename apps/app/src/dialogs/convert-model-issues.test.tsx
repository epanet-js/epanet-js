import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Issue } from "@epanet-js/converters";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import {
  ConvertModelFailedDialog,
  ConvertModelIssuesDialog,
} from "./convert-model-issues";

describe("ConvertModelFailedDialog", () => {
  it("explains an issue with no refs, interpolating its context", () => {
    render(
      <ConvertModelFailedDialog
        issues={[
          {
            code: "tableMissing",
            severity: "error",
            context: { table: "Node" },
          },
        ]}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/no Node table/i)).toBeInTheDocument();
  });
});

describe("ConvertModelIssuesDialog", () => {
  it("hides the summary until it is expanded", async () => {
    stubUserTracking();
    render(
      <ConvertModelIssuesDialog issues={linkIssues(3)} onClose={vi.fn()} />,
    );

    expect(screen.queryByText("- 1")).toBeNull();

    await expandSummary();

    expect(screen.getByText(/3 links had no hydraulic data/i)).toBeVisible();
    expect(screen.getByText("- 1")).toBeVisible();
    expect(screen.getByText("- 3")).toBeVisible();
  });

  it("reveals the remaining refs on demand", async () => {
    stubUserTracking();
    render(
      <ConvertModelIssuesDialog issues={linkIssues(6)} onClose={vi.fn()} />,
    );

    await expandSummary();

    expect(screen.queryByText("- 4")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /and 3 more/i }));

    expect(screen.getByText("- 6")).toBeVisible();
  });

  it("shows the context of a ref next to it", async () => {
    stubUserTracking();
    render(
      <ConvertModelIssuesDialog
        issues={[
          {
            code: "valveKindUnknown",
            severity: "warning",
            ref: "12",
            context: { equationType: "PRV" },
          },
        ]}
        onClose={vi.fn()}
      />,
    );

    await expandSummary();

    expect(screen.getByText("- 12 (PRV)")).toBeVisible();
  });

  it("tracks expanding the summary, not collapsing it", async () => {
    const userTracking = stubUserTracking();
    render(
      <ConvertModelIssuesDialog issues={linkIssues(1)} onClose={vi.fn()} />,
    );

    await expandSummary();
    await expandSummary();

    expect(userTracking.capture).toHaveBeenCalledTimes(1);
    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "convertModelIssues.expanded",
    });
  });
});

const expandSummary = async () => {
  await userEvent.click(
    screen.getByRole("button", { name: /what we could not import/i }),
  );
};

const linkIssues = (count: number): Issue[] =>
  Array.from({ length: count }, (_, index) => ({
    code: "linkHydraulicsMissing",
    severity: "warning",
    ref: String(index + 1),
  }));
