import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { aTestFile } from "src/__helpers__/file";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { stubProjectionsReady } from "src/__helpers__/projections";
import shp from "shpjs";
import { setWizardState } from "./__helpers__/wizard-state";
import { renderWizard } from "./__helpers__/render-wizard";

vi.mock("shpjs");

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
        errorCode: "sourceUnreadable",
      });
    });

    it("shows unsupported CRS error for unknown projections", async () => {
      const userTracking = stubUserTracking();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        currentStep: 1,
      });

      renderWizard(store);

      const file = aTestFile({
        filename: "projected.geojson",
        content: createGeoJSONWithCrs("EPSG:27700"),
      });

      await uploadFileInStep(file);

      await waitFor(() => {
        expect(
          screen.getByText(/unsupported coordinate reference system/i),
        ).toBeInTheDocument();
      });

      expect(userTracking.capture).toHaveBeenCalledWith({
        name: "importCustomerPoints.dataInput.parseError",
        fileName: "projected.geojson",
        errorCode: "coordinateSystemUnsupported",
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

  describe("shapefile upload", () => {
    it("processes valid shapefile successfully", async () => {
      vi.mocked(shp).mockResolvedValue({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [0.001, 0.001] },
            properties: { name: "Customer A", demand: 25.5 },
          },
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [0.002, 0.002] },
            properties: { name: "Customer B", demand: 50.0 },
          },
        ],
      });

      const userTracking = stubUserTracking();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, { currentStep: 1 });
      renderWizard(store);

      await uploadShapefileInStep();

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
        fileName: "customers.shp",
        propertiesCount: 2,
        featuresCount: 2,
        coordinateConversion: null,
      });
    });

    it("shows error when shapefile parsing fails", async () => {
      vi.mocked(shp).mockRejectedValue(new Error("invalid format"));

      const userTracking = stubUserTracking();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, { currentStep: 1 });
      renderWizard(store);

      await uploadShapefileInStep();

      await waitFor(() => {
        expect(screen.getByText(/failed to parse file/i)).toBeInTheDocument();
      });

      expect(userTracking.capture).toHaveBeenCalledWith({
        name: "importCustomerPoints.dataInput.parseError",
        fileName: "customers.shp",
        errorCode: "sourceUnreadable",
      });
    });

    it("does not process shapefiles until all required files are present", async () => {
      vi.mocked(shp).mockClear();

      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, { currentStep: 1 });
      renderWizard(store);

      // Upload only .shp without .dbf and .prj
      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const shpFile = aTestFile({ filename: "customers.shp" });
      await userEvent.upload(fileInput, shpFile);

      expect(shp).not.toHaveBeenCalled();
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
        errorCode: "sourceUnreadable",
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
        name: "importCustomerPoints.dataInput.parseError",
        fileName: "empty.geojson",
        errorCode: "sourceEmpty",
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

const createGeoJSONWithCrs = (crsName: string) =>
  JSON.stringify({
    type: "FeatureCollection",
    crs: { type: "name", properties: { name: crsName } },
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [530000, 180000] },
        properties: { name: "Customer A" },
      },
    ],
  });

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

const uploadShapefileInStep = async () => {
  const fileInput = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  expect(fileInput).toBeInTheDocument();

  const shpFile = aTestFile({ filename: "customers.shp" });
  const dbfFile = aTestFile({ filename: "customers.dbf" });
  const prjFile = aTestFile({ filename: "customers.prj" });

  await userEvent.upload(fileInput, [shpFile, dbfFile, prjFile]);
};
