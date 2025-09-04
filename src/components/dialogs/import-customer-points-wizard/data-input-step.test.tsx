import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { aTestFile } from "src/__helpers__/file";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { setWizardState } from "./__helpers__/wizard-state";
import { renderWizard } from "./__helpers__/render-wizard";
import { parseCustomerPoints } from "src/import/parse-customer-points";
import { CustomerPointsIssuesAccumulator } from "src/import/parse-customer-points-issues";
import { stubFeatureOn, stubFeatureOff } from "src/__helpers__/feature-flags";

describe("DataInputStep", () => {
  beforeEach(() => {
    stubUserTracking();
    stubFeatureOff("FLAG_DATA_MAPPING");
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
        issuesCount: 0,
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
        issuesCount: 0,
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
        expect(
          screen.getByRole("tab", {
            name: /data preview/i,
            current: "step",
          }),
        ).toBeInTheDocument();
      });

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
          screen.getByRole("tab", {
            name: /data preview/i,
            current: "step",
          }),
        ).toBeInTheDocument();
      });

      expect(userTracking.capture).toHaveBeenCalledWith({
        name: "importCustomerPoints.dataInput.noValidPoints",
        fileName: "no-points.geojson",
      });

      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
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

    it("handles coordinates outside WGS84 range", () => {
      const fileContent = createInvalidWGS84CoordinatesGeoJSON();
      const issues = new CustomerPointsIssuesAccumulator();
      const validCustomerPoints = [];
      let totalCount = 0;

      const demandImportUnit = "l/d";
      const demandTargetUnit = "l/s";

      for (const customerPoint of parseCustomerPoints(
        fileContent,
        issues,
        demandImportUnit,
        demandTargetUnit,
        1,
      )) {
        totalCount++;
        if (customerPoint) {
          validCustomerPoints.push(customerPoint);
        }
      }

      expect(validCustomerPoints).toHaveLength(1);
      expect(totalCount).toBe(3);

      const parsedIssues = issues.buildResult();
      expect(parsedIssues).toBeDefined();
      expect(parsedIssues!.skippedInvalidProjection).toHaveLength(2);

      const invalidFeatures = parsedIssues!.skippedInvalidProjection!;
      expect((invalidFeatures[0].geometry as any).coordinates).toEqual([
        200, 95,
      ]);
      expect((invalidFeatures[1].geometry as any).coordinates).toEqual([
        -200, -95,
      ]);
    });

    it("handles missing coordinates", () => {
      const fileContent = createMissingCoordinatesGeoJSON();
      const issues = new CustomerPointsIssuesAccumulator();
      const validCustomerPoints = [];
      let totalCount = 0;

      const demandImportUnit = "l/d";
      const demandTargetUnit = "l/s";

      for (const customerPoint of parseCustomerPoints(
        fileContent,
        issues,
        demandImportUnit,
        demandTargetUnit,
        1,
      )) {
        totalCount++;
        if (customerPoint) {
          validCustomerPoints.push(customerPoint);
        }
      }

      expect(validCustomerPoints).toHaveLength(1);
      expect(totalCount).toBe(4);

      const parsedIssues = issues.buildResult();
      expect(parsedIssues).toBeDefined();
      expect(parsedIssues!.skippedMissingCoordinates).toHaveLength(3);
    });

    it("handles invalid demand values", () => {
      const fileContent = createInvalidDemandsGeoJSON();
      const issues = new CustomerPointsIssuesAccumulator();
      const validCustomerPoints = [];
      let totalCount = 0;

      const demandImportUnit = "l/d";
      const demandTargetUnit = "l/s";

      for (const customerPoint of parseCustomerPoints(
        fileContent,
        issues,
        demandImportUnit,
        demandTargetUnit,
        1,
      )) {
        totalCount++;
        if (customerPoint) {
          validCustomerPoints.push(customerPoint);
        }
      }

      expect(validCustomerPoints).toHaveLength(1);
      expect(totalCount).toBe(6);

      const parsedIssues = issues.buildResult();
      expect(parsedIssues).toBeDefined();
      expect(parsedIssues!.skippedInvalidDemands).toHaveLength(5);
    });

    it("extracts raw data when DATA_MAPPING flag is enabled", async () => {
      stubFeatureOn("FLAG_DATA_MAPPING");

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

      expect(userTracking.capture).toHaveBeenCalledWith({
        name: "importCustomerPoints.dataInput.next",
        fileName: "mixed-features.geojson",
        propertiesCount: 3,
        featuresCount: 3,
      });

      expect(userTracking.capture).not.toHaveBeenCalledWith(
        expect.objectContaining({
          name: "importCustomerPoints.dataInput.customerPointsLoaded",
        }),
      );
    });
  });

  describe("wizard state contamination", () => {
    it("clears previous import data when new import has no valid points", async () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        currentStep: 1,
      });

      renderWizard(store);

      const validFile = aTestFile({
        filename: "valid.geojson",
        content: createValidGeoJSON(),
      });

      await uploadFileInStep(validFile);

      await waitFor(() => {
        expect(
          screen.getByRole("tab", {
            name: /data preview/i,
            current: "step",
          }),
        ).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /back/i }));

      await waitFor(() => {
        expect(
          screen.getByRole("tab", {
            name: /data input/i,
            current: "step",
          }),
        ).toBeInTheDocument();
      });

      const emptyFile = aTestFile({
        filename: "empty.geojson",
        content: createNoValidPointsGeoJSON(),
      });

      await uploadFileInStep(emptyFile);

      await waitFor(() => {
        expect(
          screen.getByRole("tab", {
            name: /data preview/i,
            current: "step",
          }),
        ).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
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

const createInvalidWGS84CoordinatesGeoJSON = () =>
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
          name: "Valid Customer A",
          demand: 25.5,
        },
      },
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [200, 95],
        },
        properties: {
          name: "Invalid coordinates 1",
          demand: 25.5,
        },
      },
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [-200, -95],
        },
        properties: {
          name: "Invalid coordinates 2",
          demand: 30.0,
        },
      },
    ],
  });

const createMissingCoordinatesGeoJSON = () =>
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
          name: "Valid Customer",
          demand: 25.5,
        },
      },
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [],
        },
        properties: {
          name: "Empty coordinates array",
          demand: 25.5,
        },
      },
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [0.001],
        },
        properties: {
          name: "Single coordinate",
          demand: 30.0,
        },
      },
      {
        type: "Feature",
        geometry: null,
        properties: {
          name: "Null geometry",
          demand: 15.0,
        },
      },
    ],
  });

const createInvalidDemandsGeoJSON = () =>
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
          name: "Valid Customer",
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
          name: "String demand",
          demand: "invalid",
        },
      },
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [0.003, 0.003],
        },
        properties: {
          name: "Null demand",
          demand: null,
        },
      },
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [0.004, 0.004],
        },
        properties: {
          name: "No demand property",
        },
      },
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [0.005, 0.005],
        },
        properties: {
          name: "Boolean true demand",
          demand: true,
        },
      },
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [0.006, 0.006],
        },
        properties: {
          name: "Boolean false demand",
          demand: false,
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
