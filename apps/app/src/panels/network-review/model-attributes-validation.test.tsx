import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { Provider as JotaiProvider } from "jotai";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { Store } from "src/state";
import { modelAttributesValidationIssuesAtom } from "src/state/network-review";
import { ValidationGroup } from "src/lib/model-attributes-validation";
import {
  ModelAttributesValidation,
  buildRows,
} from "./model-attributes-validation";

vi.mock("src/hooks/use-zoom-to", () => ({ useZoomTo: () => vi.fn() }));
vi.mock("src/infra/user-tracking", () => ({
  useUserTracking: () => ({ capture: vi.fn() }),
}));

// The shared ResizeObserver stub feeds react-virtual's measureElement an entry
// without a target; a no-op keeps the virtualized list from crashing in jsdom.
beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
});

const renderPanel = (store: Store) => {
  render(
    <JotaiProvider store={store}>
      <ModelAttributesValidation onGoBack={vi.fn()} />
    </JotaiProvider>,
  );
};

describe("ModelAttributesValidation panel", () => {
  it("computes issues and shows the count in the header", async () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(1, { label: "P1", roughness: null })
      .build();
    const store = setInitialState({ hydraulicModel });

    renderPanel(store);

    await waitFor(() => {
      expect(screen.getByText(/1 issue found/i)).toBeInTheDocument();
    });
    expect(store.get(modelAttributesValidationIssuesAtom)).toHaveLength(1);
  });

  it("shows the empty state when the model has no issues", async () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(1, { roughness: 130 })
      .build();
    const store = setInitialState({ hydraulicModel });

    renderPanel(store);

    await waitFor(() => {
      expect(
        screen.getByText(/your model attributes are valid/i),
      ).toBeInTheDocument();
    });
  });
});

describe("buildRows", () => {
  const aGroup = (
    overrides: Partial<ValidationGroup> = {},
  ): ValidationGroup => ({
    ruleId: "pipe.roughness.present",
    entityType: "pipe",
    field: "roughness",
    severity: "error",
    message: "required",
    issues: [
      {
        ruleId: "pipe.roughness.present",
        entityType: "pipe",
        entityId: 1,
        label: "P1",
        field: "roughness",
        severity: "error",
        message: "required",
      },
      {
        ruleId: "pipe.roughness.present",
        entityType: "pipe",
        entityId: 2,
        label: "P2",
        field: "roughness",
        severity: "error",
        message: "required",
      },
    ],
    ...overrides,
  });

  it("renders only group rows when nothing is expanded", () => {
    const rows = buildRows([aGroup()], new Set());

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "group" });
  });

  it("inserts a child row per issue after an expanded group", () => {
    const group = aGroup();
    const rows = buildRows([group], new Set([group.ruleId]));

    expect(rows.map((row) => row.kind)).toEqual(["group", "issue", "issue"]);
    expect(rows[1]).toMatchObject({
      kind: "issue",
      id: "issue:pipe.roughness.present:1",
    });
    expect(rows[2]).toMatchObject({
      kind: "issue",
      id: "issue:pipe.roughness.present:2",
    });
  });
});
