import type { Feature } from "geojson";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { stubProjectionsReady } from "src/__helpers__/projections";
import { setWizardState } from "./__helpers__/wizard-state";
import { renderWizard } from "./__helpers__/render-wizard";

const aPoint = (
  coordinates: [number, number],
  properties: Record<string, unknown>,
): Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates },
  properties,
});

const aSourceFile = (features: Feature[]) =>
  new File(
    [JSON.stringify({ type: "FeatureCollection", features })],
    "test.geojson",
    { type: "application/json" },
  );

describe("DataMappingStep", () => {
  beforeEach(() => {
    stubUserTracking();
    stubProjectionsReady();
  });

  describe("optional demand attribute + default value", () => {
    const namedPoints = () => [
      aPoint([0.001, 0.001], { name: "Point1" }),
      aPoint([0.002, 0.002], { name: "Point2" }),
    ];

    it("auto-parses with default demand when no attribute is selected", async () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        sourceFiles: [aSourceFile(namedPoints())],
        inputData: { properties: new Set(["name"]) },
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
        sourceFiles: [aSourceFile(namedPoints())],
        inputData: { properties: new Set(["name"]) },
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
        sourceFiles: [aSourceFile([aPoint([0.001, 0.001], { demand: 12 })])],
        inputData: { properties: new Set(["demand"]) },
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
        sourceFiles: [
          aSourceFile([
            aPoint([0.001, 0.001], { demand: 10 }),
            aPoint([0.002, 0.002], {}),
            aPoint([0.003, 0.003], { demand: null }),
          ]),
        ],
        selectedDemandProperty: "demand",
        inputData: { properties: new Set(["demand"]) },
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
        sourceFiles: [
          aSourceFile([
            aPoint([0.001, 0.001], { name: "A" }),
            aPoint([0.002, 0.002], { name: "B" }),
          ]),
        ],
        inputData: { properties: new Set(["name"]) },
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
        sourceFiles: [aSourceFile([aPoint([0.001, 0.001], { demand: 10 })])],
        inputData: { properties: new Set(["demand"]) },
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
    it("shows the pattern selector even when no patterns are defined yet", () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        sourceFiles: [
          aSourceFile([
            aPoint([0.001, 0.001], { name: "Point1", demand: 25.5 }),
          ]),
        ],
        inputData: { properties: new Set(["name", "demand"]) },
      });

      renderWizard(store);

      const patternSelector = screen.getByRole("combobox", {
        name: "Time pattern",
      });
      expect(patternSelector).toBeInTheDocument();
      expect(patternSelector).toHaveTextContent("Constant");
    });
  });

  describe("label property switching", () => {
    const twoFeatures = () => [
      aPoint([0.001, 0.001], { name: "Alpha", demand: 10 }),
      aPoint([0.002, 0.002], { name: "Beta", demand: 20 }),
    ];

    it("does not advance the auto-generated label counter when switching label property and back", async () => {
      const user = userEvent.setup();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        sourceFiles: [aSourceFile(twoFeatures())],
        inputData: { properties: new Set(["name", "demand"]) },
      });

      renderWizard(store);

      await waitFor(() => {
        expect(screen.getByText(/Customer points \(2\)/)).toBeInTheDocument();
      });

      expect(screen.getByText("CP1")).toBeInTheDocument();
      expect(screen.getByText("CP2")).toBeInTheDocument();

      const labelSelector = screen.getByRole("combobox", { name: "Label" });
      await user.click(labelSelector);
      await user.click(await screen.findByRole("option", { name: "name" }));

      await waitFor(() => {
        expect(screen.getByText("Alpha")).toBeInTheDocument();
      });
      expect(screen.getByText("Beta")).toBeInTheDocument();

      await user.click(labelSelector);
      await user.click(
        await screen.findByRole("button", {
          name: /auto.*generate/i,
        }),
      );

      await waitFor(() => {
        expect(screen.getByText("CP1")).toBeInTheDocument();
      });
      expect(screen.getByText("CP2")).toBeInTheDocument();
      expect(screen.queryByText("CP3")).not.toBeInTheDocument();
      expect(screen.queryByText("CP4")).not.toBeInTheDocument();
    });
  });
});
