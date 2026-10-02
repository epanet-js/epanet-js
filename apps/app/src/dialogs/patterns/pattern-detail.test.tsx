import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider, createStore } from "jotai";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import { PatternDetail } from "./pattern-detail";

const HOUR = 3600;

const renderDetail = () =>
  render(
    <JotaiProvider store={createStore()}>
      <TooltipProvider>
        <PatternDetail
          pattern={[1, 0.8, 1.2]}
          patternType="demand"
          patternTimestepSeconds={HOUR}
          totalDurationSeconds={24 * HOUR}
          onChange={() => {}}
        />
      </TooltipProvider>
    </JotaiProvider>,
  );

describe("PatternDetail graph type", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("switches between bar and line chart", async () => {
    stubFeatureOn("FLAG_PATTERN_LINE_GRAPH");
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByLabelText("Show as line chart"));
    expect(screen.getByLabelText("Show as bar chart")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Show as bar chart"));
    expect(screen.getByLabelText("Show as line chart")).toBeInTheDocument();
  });

  it("remembers the chosen graph type in a new session", async () => {
    stubFeatureOn("FLAG_PATTERN_LINE_GRAPH");
    const user = userEvent.setup();
    const { unmount } = renderDetail();
    await user.click(screen.getByLabelText("Show as line chart"));
    unmount();

    renderDetail();

    expect(
      await screen.findByLabelText("Show as bar chart"),
    ).toBeInTheDocument();
  });

  it("hides the toggle when the feature is off", () => {
    stubFeatureOff("FLAG_PATTERN_LINE_GRAPH");
    renderDetail();

    expect(screen.queryByLabelText("Show as line chart")).toBeNull();
    expect(screen.queryByLabelText("Show as bar chart")).toBeNull();
  });
});
