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

      const demandSelector = screen.getByRole("combobox", { name: "Demand" });
      await user.click(demandSelector);

      const demandOption = await screen.findByRole("option", {
        name: "demand",
      });
      await user.click(demandOption);

      await waitFor(() => {
        expect(screen.getByText(/Customer points \(2\)/)).toBeInTheDocument();
      });

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

      const demandSelector = screen.getByRole("combobox", { name: "Demand" });
      await user.click(demandSelector);

      const demandOption = await screen.findByRole("option", {
        name: "demand",
      });
      await user.click(demandOption);

      await waitFor(() => {
        expect(screen.getByText(/Customer points \(1\)/)).toBeInTheDocument();
      });

      expect(screen.getByText(/Issues \(1\)/)).toBeInTheDocument();

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

      const selectElement = screen.getByRole("combobox", { name: "Demand" });
      expect(selectElement).toBeInTheDocument();
      expect(selectElement).toHaveTextContent("Select demand property...");
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

  describe("pattern selector", () => {
    const createInputData = () => ({
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
    });

    it("shows pattern selector when patterns exist", () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .aDemandPattern(100, "daily", [1, 1.2, 0.8])
          .build(),
      });

      setWizardState(store, {
        selectedFile: new File(["test"], "test.geojson", {
          type: "application/json",
        }),
        inputData: createInputData(),
      });

      renderWizard(store);

      expect(
        screen.getByRole("combobox", { name: "Time pattern" }),
      ).toBeInTheDocument();
    });

    it("does not show pattern selector when no patterns exist", () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        selectedFile: new File(["test"], "test.geojson", {
          type: "application/json",
        }),
        inputData: createInputData(),
      });

      renderWizard(store);

      expect(
        screen.queryByRole("combobox", { name: "Time pattern" }),
      ).not.toBeInTheDocument();
    });

    it("applies selected pattern to parsed customer points", async () => {
      const user = userEvent.setup();

      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .aDemandPattern(100, "daily", [1, 1.2, 0.8])
          .aDemandPattern(101, "weekly", [1, 1, 1, 1, 1, 0.5, 0.5])
          .build(),
      });

      setWizardState(store, {
        selectedFile: new File(["test"], "test.geojson", {
          type: "application/json",
        }),
        inputData: createInputData(),
      });

      renderWizard(store);

      // Select demand property first
      const demandSelector = screen.getByRole("combobox", { name: "Demand" });
      await user.click(demandSelector);
      const demandOption = await screen.findByRole("option", {
        name: "demand",
      });
      await user.click(demandOption);

      await waitFor(() => {
        expect(screen.getByText(/Customer points \(1\)/)).toBeInTheDocument();
      });

      // Now select a pattern
      const patternSelector = screen.getByRole("combobox", {
        name: "Time pattern",
      });
      await user.click(patternSelector);
      const patternOption = await screen.findByRole("option", {
        name: "daily",
      });
      await user.click(patternOption);

      // Verify re-parsing occurs (customer points table should still show data)
      await waitFor(() => {
        expect(screen.getByText(/Customer points \(1\)/)).toBeInTheDocument();
      });
    });

    it("shows CONSTANT option as default in pattern selector", () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .aDemandPattern(100, "daily", [1, 1.2, 0.8])
          .build(),
      });

      setWizardState(store, {
        selectedFile: new File(["test"], "test.geojson", {
          type: "application/json",
        }),
        inputData: createInputData(),
      });

      renderWizard(store);

      const patternSelector = screen.getByRole("combobox", {
        name: "Time pattern",
      });
      expect(patternSelector).toHaveTextContent("CONSTANT");
    });
  });
});
