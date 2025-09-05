import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { stubProjectionsReady } from "src/__helpers__/projections";
import {
  setWizardState,
  createValidParsedDataSummary,
  createParsedDataSummaryWithIssues,
  createParsedDataSummaryWithInvalidDemands,
} from "./__helpers__/wizard-state";
import { renderWizard } from "./__helpers__/render-wizard";
import { aTestFile } from "src/__helpers__/file";

describe("DataMappingStep", () => {
  beforeEach(() => {
    stubUserTracking();
    stubProjectionsReady();
  });

  describe("legacy test scenarios", () => {
    it("displays customer points tab with correct styling", () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        parsedDataSummary: createValidParsedDataSummary(),
        selectedDemandProperty: "demand",
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
        selectedDemandProperty: "demand",
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
        selectedDemandProperty: "demand",
      });

      renderWizard(store);

      const issuesTab = screen.getByText(/Issues \(2\)/);
      expect(issuesTab).not.toHaveClass("cursor-not-allowed");

      const customerPointsTab = screen.getByText(/Customer Points \(2\)/);
      expect(customerPointsTab).toHaveClass("bg-green-50", "text-green-700");

      await user.click(issuesTab);

      expect(issuesTab).toHaveClass("bg-red-50", "text-red-700");
      expect(customerPointsTab).not.toHaveClass(
        "bg-green-50",
        "text-green-700",
      );

      expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: /back/i })).not.toBeDisabled();
    });

    it("displays correct counts in tab labels", () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        parsedDataSummary: createParsedDataSummaryWithIssues(),
        selectedDemandProperty: "demand",
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

  describe("current implementation", () => {
    beforeEach(() => {
      stubFeatureOn("FLAG_DATA_MAPPING");
    });

    it("shows demand property selector when inputData exists", () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        selectedFile: new File(["test"], "test.geojson", {
          type: "application/json",
        }),
        inputData: {
          properties: new Set(["name", "demand", "flow"]),
          features: [
            {
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: [0.001, 0.001],
              },
              properties: {
                name: "Point1",
                demand: 25.5,
                flow: 10.0,
              },
            },
          ],
        },
      });

      renderWizard(store);

      expect(screen.getByText("Demand")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toBeInTheDocument();

      const selectElement = screen.getByRole("combobox");
      expect(selectElement).toHaveDisplayValue("Select demand property...");

      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(4);
      expect(
        screen.getByRole("option", { name: "Select demand property..." }),
      ).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "name" })).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "demand" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "flow" })).toBeInTheDocument();
    });

    it("disables next button when no demand property is selected", () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        selectedFile: new File(["test"], "test.geojson", {
          type: "application/json",
        }),
        inputData: {
          properties: new Set(["name", "demand", "flow"]),
          features: [
            {
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: [0.001, 0.001],
              },
              properties: {
                name: "Point1",
                demand: 25.5,
              },
            },
          ],
        },
        selectedDemandProperty: null,
      });

      renderWizard(store);

      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /back/i })).not.toBeDisabled();
    });
  });

  describe.skip("Legacy tests - when FLAG_DATA_MAPPING is enabled", () => {
    beforeEach(() => {
      stubFeatureOn("FLAG_DATA_MAPPING");
    });

    it("shows loading state when parsing inputData", () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      const inputData = {
        properties: new Set(["name", "demand"]),
        features: [
          {
            type: "Feature" as const,
            geometry: {
              type: "Point" as const,
              coordinates: [0.001, 0.001],
            },
            properties: {
              name: "Point1",
              demand: 25.5,
            },
          },
        ],
      };

      setWizardState(store, {
        currentStep: 2,
        inputData,
        selectedFile: aTestFile({ filename: "test.geojson", content: "" }),
        parsedDataSummary: null,
        isLoading: true,
      });

      renderWizard(store);

      expect(screen.getByText("Data Mapping")).toBeInTheDocument();
      expect(screen.getByText(/Parsing customer points/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();
    });

    it("shows customer points when parsedDataSummary is available", () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        currentStep: 2,
        parsedDataSummary: createValidParsedDataSummary(),
        isLoading: false,
      });

      renderWizard(store);

      expect(screen.getByText(/Customer Points/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: /back/i })).not.toBeDisabled();
    });

    it("handles case when no inputData is available", () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        currentStep: 2,
        inputData: null,
        parsedDataSummary: null,
      });

      renderWizard(store);

      expect(screen.getByText("Data Mapping")).toBeInTheDocument();
      expect(screen.getByText(/No valid customer points/)).toBeInTheDocument();
    });
  });
});
