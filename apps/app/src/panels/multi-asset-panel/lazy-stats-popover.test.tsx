import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import type { QuantityStats } from "./stats";
import { LazyStatsPopoverButton } from "./summary-value-row";

const heavyStats: QuantityStats = {
  type: "quantity",
  property: "x",
  sum: 30,
  min: 10,
  max: 20,
  mean: 15,
  values: new Map([
    [10, [1]],
    [20, [2]],
  ]),
  times: 2,
  decimals: 0,
  unit: null,
};

const renderButton = (
  loadDetails: () => ReturnType<typeof Promise.resolve<QuantityStats | null>>,
) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <JotaiProvider store={createStore()}>
        <TooltipProvider>
          <LazyStatsPopoverButton
            label="X"
            property="x"
            loadDetails={loadDetails}
          />
        </TooltipProvider>
      </JotaiProvider>
    </QueryClientProvider>,
  );

describe("LazyStatsPopoverButton async loader", () => {
  it("computes the detail asynchronously on open and renders it", async () => {
    renderButton(() => Promise.resolve(heavyStats));

    await userEvent.click(
      screen.getByRole("button", { name: /stats for: x/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByLabelText<HTMLInputElement>(/value for: min/i).value,
      ).toMatch(/^10(\.0+)?$/);
    });
    expect(
      screen.getByLabelText<HTMLInputElement>(/value for: max/i).value,
    ).toMatch(/^20(\.0+)?$/);
  });
});
