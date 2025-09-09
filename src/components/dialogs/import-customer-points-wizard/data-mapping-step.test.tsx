import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { stubProjectionsReady } from "src/__helpers__/projections";
import { setWizardState } from "./__helpers__/wizard-state";
import { waitFor } from "@testing-library/react";
import { renderWizard } from "./__helpers__/render-wizard";

describe("DataMappingStep", () => {
  beforeEach(() => {
    stubUserTracking();
    stubProjectionsReady();
  });

  describe("customer points processing scenarios", () => {
    it("processes valid customer points and displays tabs correctly", async () => {
      const user = userEvent.setup();
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
            {
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: [0.002, 0.002],
              },
              properties: {
                name: "Point2",
                demand: 30.0,
              },
            },
          ],
        },
      });

      renderWizard(store);

      const demandSelector = screen.getByRole("combobox");
      await user.selectOptions(demandSelector, "demand");

      await waitFor(() => {
        expect(screen.getByText(/Customer Points \(2\)/)).toBeInTheDocument();
      });

      const customerPointsTab = screen.getByText(/Customer Points \(2\)/);
      expect(customerPointsTab).toHaveClass("bg-green-50", "text-green-700");

      const issuesTab = screen.getByText(/Issues \(0\)/);
      expect(issuesTab).toHaveClass("cursor-not-allowed");
      expect(issuesTab).toHaveClass("text-gray-300");

      expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: /back/i })).not.toBeDisabled();
    });

    it("handles invalid demands and shows issues details", async () => {
      const user = userEvent.setup();
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
            {
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: [0.002, 0.002],
              },
              properties: {
                name: "Point2",
                demand: "invalid",
              },
            },
          ],
        },
      });

      renderWizard(store);

      const demandSelector = screen.getByRole("combobox");
      await user.selectOptions(demandSelector, "demand");

      await waitFor(() => {
        expect(screen.getByText(/Customer Points \(1\)/)).toBeInTheDocument();
      });

      expect(screen.getByText(/Issues \(1\)/)).toBeInTheDocument();

      const issuesTab = screen.getByText(/Issues \(1\)/);
      expect(issuesTab).not.toHaveClass("cursor-not-allowed");

      const customerPointsTab = screen.getByText(/Customer Points \(1\)/);
      expect(customerPointsTab).toHaveClass("bg-green-50", "text-green-700");

      await user.click(issuesTab);

      expect(issuesTab).toHaveClass("bg-red-50", "text-red-700");
      expect(customerPointsTab).not.toHaveClass(
        "bg-green-50",
        "text-green-700",
      );

      expect(screen.getByText(/Invalid demands \(1\)/)).toBeInTheDocument();

      expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: /back/i })).not.toBeDisabled();
    });
  });

  describe("current implementation", () => {
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
});
