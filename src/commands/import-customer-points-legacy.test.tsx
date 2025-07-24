import { render, screen, waitFor } from "@testing-library/react";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Store, dataAtom } from "src/state/jotai";
import { Junction } from "src/hydraulic-model/asset-types/junction";
import userEvent from "@testing-library/user-event";
import { aTestFile } from "src/__helpers__/file";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";
import {
  stubFileOpen,
  stubFileOpenError,
  stubFileTextError,
} from "src/__helpers__/browser-fs-mock";
import { useImportCustomerPointsLegacy } from "./import-customer-points-legacy";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import i18n from "src/infra/i18n/i18next-config";
import enTranslations from "../../public/locales/en/translation.json";

describe("importCustomerPointsLegacy", () => {
  beforeEach(() => {
    i18n.addResourceBundle("en", "translation", enTranslations);
  });

  it("imports GeoJSON customer points correctly", async () => {
    stubFileOpen();
    const store = createStoreWithPipes();

    renderComponent({ store });

    const geoJsonContent = createGeoJSONContent();
    const file = aTestFile({
      filename: "customer-points.geojson",
      content: geoJsonContent,
    });

    await triggerCommand();
    await doFileSelection(file);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const { hydraulicModel } = store.get(dataAtom);
    expect(hydraulicModel.customerPoints.size).toBe(2);

    const customerPoint1 = hydraulicModel.customerPoints.get("1");
    const customerPoint2 = hydraulicModel.customerPoints.get("2");

    expect(customerPoint1).toBeDefined();
    expect(customerPoint1?.coordinates).toEqual([10.5, 20.5]);
    expect(customerPoint1?.baseDemand).toBe(25.5);

    expect(customerPoint2).toBeDefined();
    expect(customerPoint2?.coordinates).toEqual([30.5, 40.5]);
    expect(customerPoint2?.baseDemand).toBe(150);
  });

  it("imports GeoJSONL customer points correctly", async () => {
    stubFileOpen();
    const store = createStoreWithPipes();

    renderComponent({ store });

    const geoJsonLContent = createGeoJSONLContent();
    const file = aTestFile({
      filename: "customer-points.geojsonl",
      content: geoJsonLContent,
    });

    await triggerCommand();
    await doFileSelection(file);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const { hydraulicModel } = store.get(dataAtom);
    expect(hydraulicModel.customerPoints.size).toBe(2);

    const customerPoint1 = hydraulicModel.customerPoints.get("1");
    const customerPoint2 = hydraulicModel.customerPoints.get("2");

    expect(customerPoint1).toBeDefined();
    expect(customerPoint1?.coordinates).toEqual([15.5, 25.5]);
    expect(customerPoint2).toBeDefined();
    expect(customerPoint2?.coordinates).toEqual([35.5, 45.5]);
  });

  it("assigns IDs starting from 1 for empty model", async () => {
    stubFileOpen();
    const store = createStoreWithPipes();

    renderComponent({ store });

    const geoJsonContent = createGeoJSONContent();
    const file = aTestFile({
      filename: "customer-points.geojson",
      content: geoJsonContent,
    });

    await triggerCommand();
    await doFileSelection(file);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const { hydraulicModel } = store.get(dataAtom);
    expect(hydraulicModel.customerPoints.has("1")).toBe(true);
    expect(hydraulicModel.customerPoints.has("2")).toBe(true);
  });

  it("shows loading dialog during import", async () => {
    stubFileOpen();
    const store = createStoreWithPipes();

    renderComponent({ store });

    await triggerCommand();

    const file = aTestFile({
      filename: "customer-points.geojson",
      content: createGeoJSONContent(),
    });
    await doFileSelection(file);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/Import Successful/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Successfully imported 2 customer points?\.?/i),
    ).toBeInTheDocument();
  });

  it("shows success dialog with correct count", async () => {
    stubFileOpen();
    const store = createStoreWithPipes();

    renderComponent({ store });

    const geoJsonContent = createGeoJSONContent();
    const file = aTestFile({
      filename: "customer-points.geojson",
      content: geoJsonContent,
    });

    await triggerCommand();
    await doFileSelection(file);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/Import Successful/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Successfully imported 2 customer points?\.?/i),
    ).toBeInTheDocument();
  });

  it("captures user tracking events", async () => {
    const userTracking = stubUserTracking();
    stubFileOpen();
    const store = createStoreWithPipes();

    renderComponent({ store });

    const geoJsonContent = createGeoJSONContent();
    const file = aTestFile({
      filename: "customer-points.geojson",
      content: geoJsonContent,
    });

    await triggerCommand();
    await doFileSelection(file);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "importCustomerPoints.started",
      source: "test",
    });
    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "importCustomerPoints.completed",
      count: 2,
    });
  });

  it("handles invalid JSON gracefully", async () => {
    const userTracking = stubUserTracking();
    stubFileOpen();
    const store = createStoreWithPipes();

    renderComponent({ store });

    const invalidContent = "{ invalid json";
    const file = aTestFile({
      filename: "invalid.geojson",
      content: invalidContent,
    });

    await triggerCommand();
    await doFileSelection(file);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const { hydraulicModel } = store.get(dataAtom);
    expect(hydraulicModel.customerPoints.size).toBe(0);

    expect(screen.getByText(/Import Failed/i)).toBeInTheDocument();
    expect(
      screen.getByText(/No valid customer points found/i),
    ).toBeInTheDocument();

    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "importCustomerPoints.completedWithErrors",
      count: 0,
    });
  });

  it("skips non-Point geometries", async () => {
    stubFileOpen();
    const store = createStoreWithPipes();

    renderComponent({ store });

    const mixedGeometryContent = createMixedGeometryGeoJSON();
    const file = aTestFile({
      filename: "mixed-geometry.geojson",
      content: mixedGeometryContent,
    });

    await triggerCommand();
    await doFileSelection(file);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const { hydraulicModel } = store.get(dataAtom);
    expect(hydraulicModel.customerPoints.size).toBe(1);
    expect(hydraulicModel.customerPoints.get("1")?.coordinates).toEqual([
      10.5, 20.5,
    ]);
  });

  it("shows warning dialog when some features are skipped", async () => {
    stubFileOpen();
    const store = createStoreWithPipes();

    renderComponent({ store });

    const mixedGeometryContent = createMixedGeometryGeoJSON();
    const file = aTestFile({
      filename: "mixed-geometry.geojson",
      content: mixedGeometryContent,
    });

    await triggerCommand();
    await doFileSelection(file);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    expect(
      screen.getByText(/Import Completed with Warnings/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Imported 1 customer points?\.?/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 non-point features/)).toBeInTheDocument();
  });

  it("shows error dialog when no valid customer points found", async () => {
    stubFileOpen();
    const store = createStoreWithPipes();

    renderComponent({ store });

    const onlyNonPointContent = createOnlyNonPointGeoJSON();
    const file = aTestFile({
      filename: "only-lines.geojson",
      content: onlyNonPointContent,
    });

    await triggerCommand();
    await doFileSelection(file);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/Import Failed/i)).toBeInTheDocument();
    expect(
      screen.getByText(/No valid customer points found/i),
    ).toBeInTheDocument();
  });

  it("tracks warning completion events", async () => {
    const userTracking = stubUserTracking();
    stubFileOpen();
    const store = createStoreWithPipes();

    renderComponent({ store });

    const mixedGeometryContent = createMixedGeometryGeoJSON();
    const file = aTestFile({
      filename: "mixed-geometry.geojson",
      content: mixedGeometryContent,
    });

    await triggerCommand();
    await doFileSelection(file);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "importCustomerPoints.completedWithWarnings",
      count: 1,
      issuesCount: 1,
    });
  });

  it("attaches connection data during import", async () => {
    stubFileOpen();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 0] })
        .aPipe("P1", {
          startNodeId: "J1",
          endNodeId: "J2",
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .build(),
    });

    renderComponent({ store });

    const geoJsonWithNearbyPoints = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [5, 1],
          },
          properties: {
            name: "Customer Near Pipe",
          },
        },
      ],
    });

    const file = aTestFile({
      filename: "nearby-customer-points.geojson",
      content: geoJsonWithNearbyPoints,
    });

    await triggerCommand();
    await doFileSelection(file);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const { hydraulicModel } = store.get(dataAtom);
    const customerPoint = hydraulicModel.customerPoints.get("1");

    // Verify connection was calculated
    expect(customerPoint).toBeDefined();
    expect(customerPoint!.connection).toBeDefined();
    expect(customerPoint!.connection!.pipeId).toBe("P1");
    expect(customerPoint!.connection!.snapPoint).toBeDefined();
    expect(customerPoint!.connection!.distance).toBeGreaterThan(0);
  });

  it("assigns junctions during customer point import", async () => {
    stubFileOpen();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 0] })
        .aPipe("P1", {
          startNodeId: "J1",
          endNodeId: "J2",
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .build(),
    });

    renderComponent({ store });

    const geoJsonContent = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [3, 1] },
          properties: { demand: 50 },
        },
      ],
    });

    const file = aTestFile({
      filename: "customer-points.geojson",
      content: geoJsonContent,
    });

    await triggerCommand();
    await doFileSelection(file);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const { hydraulicModel } = store.get(dataAtom);
    const customerPoint = hydraulicModel.customerPoints.get("1");
    const junction = hydraulicModel.assets.get("J1") as Junction;

    // Verify bidirectional relationship
    expect(customerPoint!.connection!.junction).toBe(junction);
    expect(junction.customerPointCount).toBe(1);
    expect(junction.customerPoints).toContain(customerPoint);
  });

  it("generates warning when no valid junction found", async () => {
    stubFileOpen();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with()
        .aTank("T1", { coordinates: [0, 0] })
        .aReservoir("R1", { coordinates: [10, 0] })
        .aPipe("P1", {
          startNodeId: "T1",
          endNodeId: "R1",
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .build(),
    });

    renderComponent({ store });

    const geoJsonContent = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [5, 1] },
          properties: { demand: 50 },
        },
      ],
    });

    const file = aTestFile({
      filename: "customer-points.geojson",
      content: geoJsonContent,
    });

    await triggerCommand();
    await doFileSelection(file);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/Import Failed/i)).toBeInTheDocument();
    expect(
      screen.getByText(/No valid customer points found/i),
    ).toBeInTheDocument();

    const { hydraulicModel } = store.get(dataAtom);
    expect(hydraulicModel.customerPoints.size).toBe(0);
  });

  it("assigns customer points to closest junction", async () => {
    stubFileOpen();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 0] })
        .aPipe("P1", {
          startNodeId: "J1",
          endNodeId: "J2",
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .build(),
    });

    renderComponent({ store });

    const geoJsonContent = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [8, 1] },
          properties: { demand: 50 },
        },
      ],
    });

    const file = aTestFile({
      filename: "customer-points.geojson",
      content: geoJsonContent,
    });

    await triggerCommand();
    await doFileSelection(file);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const { hydraulicModel } = store.get(dataAtom);
    const customerPoint = hydraulicModel.customerPoints.get("1");
    const junction2 = hydraulicModel.assets.get("J2") as Junction;

    // Customer point at [8, 1] should be assigned to J2 (closer to snap point)
    expect(customerPoint!.connection!.junction).toBe(junction2);
    expect(junction2.customerPointCount).toBe(1);
  });

  it("excludes tanks and reservoirs from junction assignment", async () => {
    stubFileOpen();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aTank("T1", { coordinates: [10, 0] })
        .aPipe("P1", {
          startNodeId: "J1",
          endNodeId: "T1",
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .build(),
    });

    renderComponent({ store });

    const geoJsonContent = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [8, 1] },
          properties: { demand: 50 },
        },
      ],
    });

    const file = aTestFile({
      filename: "customer-points.geojson",
      content: geoJsonContent,
    });

    await triggerCommand();
    await doFileSelection(file);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const { hydraulicModel } = store.get(dataAtom);
    const customerPoint = hydraulicModel.customerPoints.get("1");
    const junction = hydraulicModel.assets.get("J1") as Junction;

    // Tank should be excluded, junction should be assigned
    expect(customerPoint!.connection!.junction).toBe(junction);
    expect(junction.customerPointCount).toBe(1);
  });

  it("shows unexpected error dialog when file access fails", async () => {
    const userTracking = stubUserTracking();
    stubFileOpenError();
    const store = createStoreWithPipes();

    renderComponent({ store });

    await triggerCommand();

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/Something Went Wrong/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Something went wrong. If the error persists, contact support./,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Try Again/i }),
    ).toBeInTheDocument();

    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "importCustomerPoints.unexpectedError",
      error: "File access failed",
    });
  });

  it("shows unexpected error dialog when file reading fails", async () => {
    const userTracking = stubUserTracking();
    stubFileTextError();
    const store = createStoreWithPipes();

    renderComponent({ store });

    const file = aTestFile({
      filename: "customer-points.geojson",
      content: "valid content",
    });

    await triggerCommand();
    await doFileSelection(file);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/Something Went Wrong/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Try Again/i }),
    ).toBeInTheDocument();

    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "importCustomerPoints.unexpectedError",
      error: "Failed to read file text",
    });
  });

  it("allows retry when unexpected error occurs", async () => {
    stubFileOpenError();
    const store = createStoreWithPipes();

    renderComponent({ store });

    await triggerCommand();

    await waitFor(() => {
      expect(screen.getByText(/Something Went Wrong/)).toBeInTheDocument();
    });

    stubFileOpen();

    const file = aTestFile({
      filename: "customer-points.geojson",
      content: createGeoJSONContent(),
    });

    await userEvent.click(screen.getByRole("button", { name: /Try Again/i }));
    await doFileSelection(file);

    await waitFor(() => {
      expect(screen.getByText(/Import Successful/i)).toBeInTheDocument();
    });
  });

  it("closes error dialog when cancel is clicked", async () => {
    stubFileOpenError();
    const store = createStoreWithPipes();

    renderComponent({ store });

    await triggerCommand();

    await waitFor(() => {
      expect(screen.getByText(/Something Went Wrong/)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(
        screen.queryByText(/Something Went Wrong/),
      ).not.toBeInTheDocument();
    });
  });

  it("tracks cancellation when user aborts file selection", async () => {
    const userTracking = stubUserTracking();
    const abortError = new Error("User aborted");
    abortError.name = "AbortError";
    stubFileOpenError(abortError);

    const store = createStoreWithPipes();
    renderComponent({ store });

    await triggerCommand();

    await waitFor(() => {
      expect(userTracking.capture).toHaveBeenCalledWith({
        name: "importCustomerPoints.canceled",
      });
    });

    // Verify no error dialog is shown
    expect(screen.queryByText(/Something Went Wrong/)).not.toBeInTheDocument();
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();

    // Verify hydraulic model unchanged
    const { hydraulicModel } = store.get(dataAtom);
    expect(hydraulicModel.customerPoints.size).toBe(0);
  });
});

const triggerCommand = async () => {
  await userEvent.click(
    screen.getByRole("button", { name: "importCustomerPointsLegacy" }),
  );
};

const doFileSelection = async (file: File) => {
  await userEvent.upload(screen.getByTestId("file-upload"), file);
};

const TestableComponent = () => {
  const importCustomerPoints = useImportCustomerPointsLegacy();

  return (
    <button
      aria-label="importCustomerPointsLegacy"
      onClick={() => importCustomerPoints({ source: "test" })}
    >
      Import Customer Points Legacy
    </button>
  );
};

const createGeoJSONContent = (): string => {
  return JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [10.5, 20.5],
        },
        properties: {
          name: "Customer A",
          type: "Residential",
          demand: 25.5,
        },
      },
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [30.5, 40.5],
        },
        properties: {
          name: "Customer B",
          type: "Commercial",
          demand: 150.0,
        },
      },
    ],
  });
};

const createGeoJSONLContent = (): string => {
  return [
    '{"type":"metadata","generator":"test","version":"1.0.0"}',
    '{"type":"Feature","geometry":{"type":"Point","coordinates":[15.5,25.5]},"properties":{"name":"Customer X","type":"Residential","demand":30.0}}',
    '{"type":"Feature","geometry":{"type":"Point","coordinates":[35.5,45.5]},"properties":{"name":"Customer Y","type":"Industrial","demand":200.0}}',
  ].join("\n");
};

const createMixedGeometryGeoJSON = (): string => {
  return JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [10.5, 20.5],
        },
        properties: {
          name: "Point Customer",
          type: "Residential",
        },
      },
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [10, 20],
            [30, 40],
          ],
        },
        properties: {
          name: "Line Feature",
          type: "Should be skipped",
        },
      },
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
              [0, 0],
            ],
          ],
        },
        properties: {
          name: "Polygon Feature",
          type: "Should be skipped",
        },
      },
    ],
  });
};

const createOnlyNonPointGeoJSON = (): string => {
  return JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [10, 20],
            [30, 40],
          ],
        },
        properties: {
          name: "Line Feature 1",
        },
      },
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
              [0, 0],
            ],
          ],
        },
        properties: {
          name: "Polygon Feature 1",
        },
      },
    ],
  });
};

const createStoreWithPipes = (
  additionalSetup?: (builder: HydraulicModelBuilder) => HydraulicModelBuilder,
) => {
  const baseModel = HydraulicModelBuilder.with()
    .aJunction("J1", { coordinates: [0, 0] })
    .aJunction("J2", { coordinates: [50, 50] })
    .aPipe("P1", {
      startNodeId: "J1",
      endNodeId: "J2",
      coordinates: [
        [0, 0],
        [50, 50],
      ],
    });

  const finalModel = additionalSetup ? additionalSetup(baseModel) : baseModel;

  return setInitialState({
    hydraulicModel: finalModel.build(),
  });
};

const renderComponent = ({ store }: { store: Store }) => {
  render(
    <CommandContainer store={store}>
      <TestableComponent />
    </CommandContainer>,
  );
};
