import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { aTestFile } from "src/__helpers__/file";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { setWizardState } from "./__helpers__/wizard-state";
import { renderWizard } from "./__helpers__/render-wizard";

describe("DataInputStep", () => {
  beforeEach(() => {
    stubUserTracking();
  });

  describe("initial render", () => {
    it("shows Next button disabled when no file selected", () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        currentStep: 1,
        parsedDataSummary: null,
      });

      renderWizard(store);

      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    });
  });

  describe("successful file upload", () => {
    it("processes valid GeoJSON file successfully", async () => {
      const userTracking = stubUserTracking();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        currentStep: 1,
      });

      renderWizard(store);

      const file = aTestFile({
        filename: "customer-points.geojson",
        content: createValidGeoJSON(),
      });

      await uploadFileInStep(file);

      await waitFor(() => {
        expect(
          screen.getByRole("tab", {
            name: /data preview/i,
            current: "step",
          }),
        ).toBeInTheDocument();
      });

      expect(userTracking.capture).toHaveBeenCalledWith({
        name: "importCustomerPoints.dataInput.customerPointsLoaded",
        validCount: 2,
        totalCount: 2,
        fileName: "customer-points.geojson",
      });
    });

    it("processes valid GeoJSONL file successfully", async () => {
      const userTracking = stubUserTracking();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        currentStep: 1,
      });

      renderWizard(store);

      const file = aTestFile({
        filename: "customer-points.geojsonl",
        content: createValidGeoJSONL(),
      });

      await uploadFileInStep(file);

      await waitFor(() => {
        expect(
          screen.getByRole("tab", {
            name: /data preview/i,
            current: "step",
          }),
        ).toBeInTheDocument();
      });

      expect(userTracking.capture).toHaveBeenCalledWith({
        name: "importCustomerPoints.dataInput.customerPointsLoaded",
        validCount: 2,
        totalCount: 2,
        fileName: "customer-points.geojsonl",
      });
    });
  });

  describe("error handling", () => {
    it("handles invalid JSON format", async () => {
      const userTracking = stubUserTracking();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        currentStep: 1,
      });

      renderWizard(store);

      const file = aTestFile({
        filename: "invalid.geojson",
        content: createInvalidJSON(),
      });

      await uploadFileInStep(file);

      await waitFor(() => {
        expect(screen.getByText(/no valid customer/i)).toBeInTheDocument();
      });

      expect(
        screen.getByRole("tab", {
          name: /data input/i,
          current: "step",
        }),
      ).toBeInTheDocument();

      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();

      expect(userTracking.capture).toHaveBeenCalledWith({
        name: "importCustomerPoints.dataInput.noValidPoints",
        fileName: "invalid.geojson",
      });
    });

    it("handles files with no valid customer points", async () => {
      const userTracking = stubUserTracking();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        currentStep: 1,
      });

      renderWizard(store);

      const file = aTestFile({
        filename: "no-points.geojson",
        content: createNoValidPointsGeoJSON(),
      });

      await uploadFileInStep(file);

      await waitFor(() => {
        expect(
          screen.getByText(/no valid customer points found/i),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByRole("tab", {
          name: /data input/i,
          current: "step",
        }),
      ).toBeInTheDocument();

      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();

      expect(userTracking.capture).toHaveBeenCalledWith({
        name: "importCustomerPoints.dataInput.noValidPoints",
        fileName: "no-points.geojson",
      });
    });

    it("handles unsupported file formats (CSV)", async () => {
      const userTracking = stubUserTracking();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        currentStep: 1,
      });

      renderWizard(store);

      const file = aTestFile({
        filename: "customer-data.csv",
        content: "name,lat,lng,demand\nCustomer A,0.001,0.001,25.5",
      });

      await uploadInvalidFile(file);

      await waitFor(() => {
        expect(
          screen.getByText(/file format not supported/i),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByRole("tab", {
          name: /data input/i,
          current: "step",
        }),
      ).toBeInTheDocument();

      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();

      expect(userTracking.capture).toHaveBeenCalledWith({
        name: "importCustomerPoints.dataInput.unsupportedFormat",
        fileName: "customer-data.csv",
      });
    });
  });
});

const createValidGeoJSON = () =>
  JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [0.001, 0.001],
        },
        properties: {
          name: "Customer A",
          demand: 25.5,
        },
      },
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [0.002, 0.002],
        },
        properties: {
          name: "Customer B",
          demand: 50.0,
        },
      },
    ],
  });

const createValidGeoJSONL = () =>
  [
    '{"type":"Feature","geometry":{"type":"Point","coordinates":[0.001,0.001]},"properties":{"name":"Customer A","demand":25.5}}',
    '{"type":"Feature","geometry":{"type":"Point","coordinates":[0.002,0.002]},"properties":{"name":"Customer B","demand":50.0}}',
  ].join("\n");

const createInvalidJSON = () => "{ invalid json";

const createNoValidPointsGeoJSON = () =>
  JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [0.001, 0.001],
            [0.002, 0.002],
          ],
        },
        properties: {
          name: "Not a point",
          demand: 25.5,
        },
      },
    ],
  });

const uploadFileInStep = async (file: File) => {
  const dropZone = screen.getByTestId("customer-points-drop-zone");
  await userEvent.click(dropZone);

  const fileInput = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  expect(fileInput).toBeInTheDocument();

  await userEvent.upload(fileInput, file);
};

const uploadInvalidFile = async (file: File) => {
  const dropZone = screen.getByTestId("customer-points-drop-zone");
  await userEvent.click(dropZone);

  const fileInput = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  expect(fileInput).toBeInTheDocument();

  Object.defineProperty(fileInput, "files", {
    value: [file],
    writable: false,
  });

  fileInput.dispatchEvent(new Event("change", { bubbles: true }));
};
