import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { aTestFile } from "src/__helpers__/file";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { stubProjectionsReady } from "src/__helpers__/projections";
import { setWizardState } from "./__helpers__/wizard-state";
import { renderWizard } from "./__helpers__/render-wizard";

describe("DataInputStep", () => {
  beforeEach(() => {
    stubUserTracking();
    stubProjectionsReady();
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
        name: "importCustomerPoints.dataInput.fileLoaded",
        fileName: "customer-points.geojson",
        propertiesCount: 2,
        featuresCount: 2,
        coordinateConversion: null,
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
        name: "importCustomerPoints.dataInput.fileLoaded",
        fileName: "customer-points.geojsonl",
        propertiesCount: 2,
        featuresCount: 2,
        coordinateConversion: null,
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
        expect(
          screen.getByRole("tab", {
            name: /data input/i,
            current: "step",
          }),
        ).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();

      expect(userTracking.capture).toHaveBeenCalledWith({
        name: "importCustomerPoints.dataInput.parseError",
        fileName: "invalid.geojson",
      });
    });

    it("handles files with non-point geometries", async () => {
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
          screen.getByRole("tab", {
            name: /data preview/i,
            current: "step",
          }),
        ).toBeInTheDocument();
      });

      expect(userTracking.capture).toHaveBeenCalledWith({
        name: "importCustomerPoints.dataInput.fileLoaded",
        fileName: "no-points.geojson",
        propertiesCount: 2,
        featuresCount: 1,
        coordinateConversion: null,
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

    it("extracts raw data from mixed feature types", async () => {
      const userTracking = stubUserTracking();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        currentStep: 1,
      });

      renderWizard(store);

      const file = aTestFile({
        filename: "mixed-features.geojson",
        content: createMixedFeaturesGeoJSON(),
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

      expect(userTracking.capture).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "importCustomerPoints.dataInput.fileLoaded",
          fileName: "mixed-features.geojson",
          propertiesCount: 3,
          featuresCount: 3,
        }),
      );

      expect(userTracking.capture).not.toHaveBeenCalledWith(
        expect.objectContaining({
          name: "importCustomerPoints.dataInput.customerPointsLoaded",
        }),
      );
    });
  });

  describe("file processing error handling", () => {
    it("shows parse error and stays on current step when JSON parsing fails", async () => {
      const userTracking = stubUserTracking();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        currentStep: 1,
      });

      renderWizard(store);

      const invalidFile = aTestFile({
        filename: "invalid.geojson",
        content: createInvalidJSON(),
      });

      await uploadFileInStep(invalidFile);

      await waitFor(() => {
        expect(screen.getByText(/failed to parse file/i)).toBeInTheDocument();
      });

      expect(userTracking.capture).toHaveBeenCalledWith({
        name: "importCustomerPoints.dataInput.parseError",
        fileName: "invalid.geojson",
      });

      expect(
        screen.getByRole("tab", {
          name: /data input/i,
          current: "step",
        }),
      ).toBeInTheDocument();

      expect(userTracking.capture).not.toHaveBeenCalledWith(
        expect.objectContaining({
          name: "importCustomerPoints.dataInput.fileLoaded",
        }),
      );
    });

    it("shows no valid points error and stays on current step when no features extracted", async () => {
      const userTracking = stubUserTracking();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        currentStep: 1,
      });

      renderWizard(store);

      const emptyFile = aTestFile({
        filename: "empty.geojson",
        content: createEmptyFeaturesGeoJSON(),
      });

      await uploadFileInStep(emptyFile);

      await waitFor(() => {
        expect(
          screen.getByText(
            /no valid customer points found in the selected file/i,
          ),
        ).toBeInTheDocument();
      });

      expect(userTracking.capture).toHaveBeenCalledWith({
        name: "importCustomerPoints.dataInput.noValidPoints",
        fileName: "empty.geojson",
      });

      expect(
        screen.getByRole("tab", {
          name: /data input/i,
          current: "step",
        }),
      ).toBeInTheDocument();

      expect(userTracking.capture).not.toHaveBeenCalledWith(
        expect.objectContaining({
          name: "importCustomerPoints.dataInput.fileLoaded",
        }),
      );
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

const createEmptyFeaturesGeoJSON = () =>
  JSON.stringify({
    type: "FeatureCollection",
    features: [],
  });

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

const createMixedFeaturesGeoJSON = () =>
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
          category: "residential",
        },
      },
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
          name: "Pipeline",
          demand: 100,
        },
      },
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0.001, 0.001],
              [0.002, 0.002],
              [0.003, 0.001],
              [0.001, 0.001],
            ],
          ],
        },
        properties: {
          name: "Service Area",
          category: "commercial",
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
