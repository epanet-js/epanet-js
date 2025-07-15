import { render, screen, waitFor } from "@testing-library/react";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Store, dataAtom } from "src/state/jotai";
import userEvent from "@testing-library/user-event";
import { aTestFile } from "src/__helpers__/file";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";
import { stubFileOpen } from "src/__helpers__/browser-fs-mock";
import { useImportCustomerPoints } from "./import-customer-points";
import { stubUserTracking } from "src/__helpers__/user-tracking";

describe("importCustomerPoints", () => {
  it("imports GeoJSON customer points correctly", async () => {
    stubFileOpen();
    const store = setInitialState();

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
    expect(customerPoint1?.properties.name).toBe("Customer A");

    expect(customerPoint2).toBeDefined();
    expect(customerPoint2?.coordinates).toEqual([30.5, 40.5]);
    expect(customerPoint2?.properties.name).toBe("Customer B");
  });

  it("imports GeoJSONL customer points correctly", async () => {
    stubFileOpen();
    const store = setInitialState();

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
    expect(customerPoint1?.properties.name).toBe("Customer X");

    expect(customerPoint2).toBeDefined();
    expect(customerPoint2?.coordinates).toEqual([35.5, 45.5]);
    expect(customerPoint2?.properties.name).toBe("Customer Y");
  });

  it("assigns IDs starting from 1 for empty model", async () => {
    stubFileOpen();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });

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
    const store = setInitialState();

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

    expect(screen.getByText("Import Successful")).toBeInTheDocument();
    expect(
      screen.getByText("Successfully imported 2 customer points."),
    ).toBeInTheDocument();
  });

  it("shows success dialog with correct count", async () => {
    stubFileOpen();
    const store = setInitialState();

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

    expect(screen.getByText("Import Successful")).toBeInTheDocument();
    expect(
      screen.getByText("Successfully imported 2 customer points."),
    ).toBeInTheDocument();
  });

  it("captures user tracking events", async () => {
    const userTracking = stubUserTracking();
    stubFileOpen();
    const store = setInitialState();

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
      source: "test",
      count: 2,
    });
  });

  it("handles invalid JSON gracefully", async () => {
    const userTracking = stubUserTracking();
    stubFileOpen();
    const store = setInitialState();

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

    expect(screen.getByText("Import Successful")).toBeInTheDocument();
    expect(
      screen.getByText("Successfully imported 0 customer points."),
    ).toBeInTheDocument();

    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "importCustomerPoints.completed",
      source: "test",
      count: 0,
    });
  });

  it("skips non-Point geometries", async () => {
    stubFileOpen();
    const store = setInitialState();

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
    expect(hydraulicModel.customerPoints.get("1")?.properties.name).toBe(
      "Point Customer",
    );
  });
});

const triggerCommand = async () => {
  await userEvent.click(
    screen.getByRole("button", { name: "importCustomerPoints" }),
  );
};

const doFileSelection = async (file: File) => {
  await userEvent.upload(screen.getByTestId("file-upload"), file);
};

const TestableComponent = () => {
  const importCustomerPoints = useImportCustomerPoints();

  return (
    <button
      aria-label="importCustomerPoints"
      onClick={() => importCustomerPoints({ source: "test" })}
    >
      Import Customer Points
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

const renderComponent = ({ store }: { store: Store }) => {
  render(
    <CommandContainer store={store}>
      <TestableComponent />
    </CommandContainer>,
  );
};
