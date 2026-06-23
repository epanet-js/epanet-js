import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { createStore, Provider as JotaiProvider } from "jotai";
import { ModelAttributesValidationDialog } from "./model-attributes-validation";

const renderDialog = (
  props: Partial<{
    issueCount: number;
    onFixFirst: () => void;
    onRunAnyway: () => void;
    onClose: () => void;
  }> = {},
) => {
  const store = createStore();
  const resolved = {
    issueCount: 3,
    onFixFirst: vi.fn(),
    onRunAnyway: vi.fn(),
    onClose: vi.fn(),
    ...props,
  };
  render(
    <JotaiProvider store={store}>
      <ModelAttributesValidationDialog {...resolved} />
    </JotaiProvider>,
  );
  return resolved;
};

describe("ModelAttributesValidationDialog", () => {
  it("shows the issue count in the body", () => {
    renderDialog({ issueCount: 3 });

    expect(screen.getByText(/found 3 issue/i)).toBeInTheDocument();
  });

  it("runs the fix-first callback and closes when fixing first", () => {
    const { onFixFirst, onRunAnyway, onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Fix issues first" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onFixFirst).toHaveBeenCalledTimes(1);
    expect(onRunAnyway).not.toHaveBeenCalled();
  });

  it("runs the run-anyway callback and closes when running anyway", () => {
    const { onFixFirst, onRunAnyway, onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Run anyway" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onRunAnyway).toHaveBeenCalledTimes(1);
    expect(onFixFirst).not.toHaveBeenCalled();
  });
});
