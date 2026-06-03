import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { stubProjectionsReady } from "src/__helpers__/projections";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import { setWizardState } from "./__helpers__/wizard-state";
import { renderWizard } from "./__helpers__/render-wizard";

describe("DataMappingStepFlexible (FLAG_CP_OPTIONAL_DEMAND)", () => {
  beforeEach(() => {
    stubUserTracking();
    stubProjectionsReady();
    stubFeatureOn("FLAG_CP_OPTIONAL_DEMAND");
  });

  describe("optional demand attribute + default value", () => {
    const createInputData = () => ({
      properties: new Set(["name"]),
      features: [
        {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [0.001, 0.001] },
          properties: { name: "Point1" },
        },
        {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [0.002, 0.002] },
          properties: { name: "Point2" },
        },
      ],
    });

    it("auto-parses with default demand when no attribute is selected", async () => {
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

      await waitFor(() => {
        expect(screen.getByText(/Customer points \(2\)/)).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();
    });

    it("keeps next enabled with no demand attribute selected", async () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        selectedFile: new File(["test"], "test.geojson", {
          type: "application/json",
        }),
        inputData: createInputData(),
        selectedDemandProperty: null,
      });

      renderWizard(store);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /next/i }),
        ).not.toBeDisabled();
      });
    });

    it("keeps the default demand input editable when an attribute is selected", async () => {
      const user = userEvent.setup();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        selectedFile: new File(["test"], "test.geojson", {
          type: "application/json",
        }),
        inputData: {
          properties: new Set(["demand"]),
          features: [
            {
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: [0.001, 0.001],
              },
              properties: { demand: 12 },
            },
          ],
        },
      });

      renderWizard(store);

      const defaultDemandInput = screen.getByLabelText(
        /Value for: Default demand/i,
      );
      expect(defaultDemandInput).not.toBeDisabled();

      const demandSelector = screen.getByRole("combobox", { name: "Demand" });
      await user.click(demandSelector);
      await user.click(await screen.findByRole("option", { name: "demand" }));

      await waitFor(() => {
        expect(
          screen.getByRole("combobox", { name: "Demand" }),
        ).toHaveTextContent("demand");
      });
      expect(defaultDemandInput).not.toBeDisabled();
    });
  });

  describe("default demand fallback notice", () => {
    it("reports how many points used the default value when the attribute is missing on some features", async () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        selectedFile: new File(["test"], "test.geojson", {
          type: "application/json",
        }),
        selectedDemandProperty: "demand",
        inputData: {
          properties: new Set(["demand"]),
          features: [
            {
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: [0.001, 0.001],
              },
              properties: { demand: 10 },
            },
            {
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: [0.002, 0.002],
              },
              properties: {},
            },
            {
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: [0.003, 0.003],
              },
              properties: { demand: null },
            },
          ],
        },
      });

      renderWizard(store);

      await waitFor(() => {
        expect(screen.getByText(/Invalid demands \(2\)/i)).toBeInTheDocument();
      });
    });

    it("does not show the notice when every point is defaulted (no attribute selected)", async () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        selectedFile: new File(["test"], "test.geojson", {
          type: "application/json",
        }),
        inputData: {
          properties: new Set(["name"]),
          features: [
            {
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: [0.001, 0.001],
              },
              properties: { name: "A" },
            },
            {
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: [0.002, 0.002],
              },
              properties: { name: "B" },
            },
          ],
        },
      });

      renderWizard(store);

      await waitFor(() => {
        expect(screen.getByText(/Customer points \(2\)/)).toBeInTheDocument();
      });

      expect(screen.queryByText(/Invalid demands/i)).not.toBeInTheDocument();
    });

    it("does not show the notice when every point has a valid attribute value", async () => {
      const user = userEvent.setup();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        selectedFile: new File(["test"], "test.geojson", {
          type: "application/json",
        }),
        inputData: {
          properties: new Set(["demand"]),
          features: [
            {
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: [0.001, 0.001],
              },
              properties: { demand: 10 },
            },
          ],
        },
      });

      renderWizard(store);

      const demandSelector = screen.getByRole("combobox", { name: "Demand" });
      await user.click(demandSelector);
      await user.click(await screen.findByRole("option", { name: "demand" }));

      await waitFor(() => {
        expect(screen.getByText(/Customer points \(1\)/)).toBeInTheDocument();
      });

      expect(screen.queryByText(/Invalid demands/i)).not.toBeInTheDocument();
    });
  });

  describe("pattern selector visibility", () => {
    const createInputData = () => ({
      properties: new Set(["name", "demand"]),
      features: [
        {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [0.001, 0.001] },
          properties: { name: "Point1", demand: 25.5 },
        },
      ],
    });

    it("shows the pattern selector even when no patterns are defined yet", () => {
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

      const patternSelector = screen.getByRole("combobox", {
        name: "Time pattern",
      });
      expect(patternSelector).toBeInTheDocument();
      expect(patternSelector).toHaveTextContent("Constant");
    });
  });
});
