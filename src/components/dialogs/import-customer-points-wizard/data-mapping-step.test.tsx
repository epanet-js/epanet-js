import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import {
  setWizardState,
  createValidParsedDataSummary,
  createParsedDataSummaryWithIssues,
  createParsedDataSummaryWithInvalidDemands,
} from "./__helpers__/wizard-state";
import { renderWizard } from "./__helpers__/render-wizard";

describe("DataMappingStep", () => {
  it("displays customer points tab with correct styling", () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });

    setWizardState(store, {
      parsedDataSummary: createValidParsedDataSummary(),
    });

    renderWizard(store);

    expect(screen.getByText("Import Customer Points")).toBeInTheDocument();

    const customerPointsTab = screen.getByText(/Customer Points \(2\)/);
    expect(customerPointsTab).toHaveClass("bg-green-50", "text-green-700");

    expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /back/i })).not.toBeDisabled();
  });

  it("disables and styles issues tab when no issues exist", () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });

    setWizardState(store, {
      parsedDataSummary: createValidParsedDataSummary(),
    });

    renderWizard(store);

    const issuesTab = screen.getByText(/Issues \(0\)/);
    expect(issuesTab).toHaveClass("cursor-not-allowed");
    expect(issuesTab).toHaveClass("text-gray-300");

    expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /back/i })).not.toBeDisabled();
  });

  it("enables issues tab and allows switching when issues exist", async () => {
    const user = userEvent.setup();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });

    setWizardState(store, {
      parsedDataSummary: createParsedDataSummaryWithIssues(),
    });

    renderWizard(store);

    const issuesTab = screen.getByText(/Issues \(2\)/);
    expect(issuesTab).not.toHaveClass("cursor-not-allowed");

    const customerPointsTab = screen.getByText(/Customer Points \(2\)/);
    expect(customerPointsTab).toHaveClass("bg-green-50", "text-green-700");

    await user.click(issuesTab);

    expect(issuesTab).toHaveClass("bg-red-50", "text-red-700");
    expect(customerPointsTab).not.toHaveClass("bg-green-50", "text-green-700");

    expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /back/i })).not.toBeDisabled();
  });

  it("displays correct counts in tab labels", () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });

    setWizardState(store, {
      parsedDataSummary: createParsedDataSummaryWithIssues(),
    });

    renderWizard(store);

    expect(screen.getByText(/Customer Points \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/Issues \(2\)/)).toBeInTheDocument();
  });

  it("displays invalid demands in issues tab", async () => {
    const user = userEvent.setup();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });

    setWizardState(store, {
      parsedDataSummary: createParsedDataSummaryWithInvalidDemands(),
    });

    renderWizard(store);

    expect(screen.getByText(/Customer Points \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Issues \(2\)/)).toBeInTheDocument();

    const issuesTab = screen.getByText(/Issues \(2\)/);
    await user.click(issuesTab);

    expect(screen.getByText(/Invalid demands \(2\)/)).toBeInTheDocument();
  });
});
