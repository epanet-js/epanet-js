import { render, screen, waitFor } from "@testing-library/react";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Store, dataAtom } from "src/state/jotai";
import { Junction } from "src/hydraulic-model/asset-types/junction";
import userEvent from "@testing-library/user-event";
import { aTestFile } from "src/__helpers__/file";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useImportCustomerPoints } from "./import-customer-points";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import toast from "react-hot-toast";

describe("importCustomerPoints", () => {
  beforeEach(() => {
    toast.remove();
  });

  it("imports GeoJSON customer points correctly", async () => {
    const store = createStoreWithPipes();

    renderComponent({ store });

    const geoJsonContent = createGeoJSONContent();
    const file = aTestFile({
      filename: "customer-points.geojson",
      content: geoJsonContent,
    });

    await triggerCommand();
    await waitForWizardToOpen();

    expectWizardStep("data input");

    await uploadFileInWizard(file);

    expectWizardStep("demand options");
    expect(
      screen.getByText("Demand Options (2 Customer Points)"),
    ).toBeInTheDocument();

    await finishWizardImport();
    await expectSuccessNotification(2);

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

  it("assigns IDs starting from 1 for empty model", async () => {
    const store = createStoreWithPipes();

    renderComponent({ store });

    const geoJsonContent = createGeoJSONContent();
    const file = aTestFile({
      filename: "customer-points.geojson",
      content: geoJsonContent,
    });

    await triggerCommand();
    await waitForWizardToOpen();

    expectWizardStep("data input");

    await uploadFileInWizard(file);

    expectWizardStep("demand options");

    await finishWizardImport();
    await expectSuccessNotification();

    const { hydraulicModel } = store.get(dataAtom);
    expect(hydraulicModel.customerPoints.has("1")).toBe(true);
    expect(hydraulicModel.customerPoints.has("2")).toBe(true);
  });

  it("captures user tracking events", async () => {
    const userTracking = stubUserTracking();
    const store = createStoreWithPipes();

    renderComponent({ store });

    const geoJsonContent = createGeoJSONContent();
    const file = aTestFile({
      filename: "customer-points.geojson",
      content: geoJsonContent,
    });

    await triggerCommand();
    await waitForWizardToOpen();
    expectWizardStep("data input");
    await uploadFileInWizard(file);
    expectWizardStep("demand options");
    await finishWizardImport();
    await expectSuccessNotification();

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
    const store = createStoreWithPipes();

    renderComponent({ store });

    const invalidContent = "{ invalid json";

    await triggerCommand();
    await waitForWizardToOpen();

    expectWizardStep("data input");

    await uploadFileWithParseError(invalidContent);

    await waitFor(() => {
      expect(screen.getByText(/no valid/i)).toBeInTheDocument();
    });
    expectWizardStep("data input");
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "importCustomerPoints.noValidPoints",
    });

    const { hydraulicModel } = store.get(dataAtom);
    expect(hydraulicModel.customerPoints.size).toBe(0);
  });

  it("tracks no valid points event", async () => {
    const userTracking = stubUserTracking();
    const store = createStoreWithPipes();

    renderComponent({ store });

    const emptyGeoJsonContent = JSON.stringify({
      type: "FeatureCollection",
      features: [],
    });

    const file = aTestFile({
      filename: "empty.geojson",
      content: emptyGeoJsonContent,
    });

    await triggerCommand();
    await waitForWizardToOpen();

    expectWizardStep("data input");

    await uploadFileInWizard(file);

    await waitFor(() => {
      expect(
        screen.getByText(/no valid customer points found/i),
      ).toBeInTheDocument();
    });
    expectWizardStep("data input");
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "importCustomerPoints.noValidPoints",
    });

    const { hydraulicModel } = store.get(dataAtom);
    expect(hydraulicModel.customerPoints.size).toBe(0);
  });

  it("skips non-Point geometries", async () => {
    const store = createStoreWithPipes();

    renderComponent({ store });

    const mixedGeometryContent = createMixedGeometryGeoJSON();
    const file = aTestFile({
      filename: "mixed-geometry.geojson",
      content: mixedGeometryContent,
    });

    await triggerCommand();
    await waitForWizardToOpen();
    expectWizardStep("data input");
    await uploadFileInWizard(file);
    expectWizardStep("demand options");
    expect(
      screen.getByText("Demand Options (1 Customer Point)"),
    ).toBeInTheDocument();

    await finishWizardImport();
    await expectSuccessNotification(1);

    const { hydraulicModel } = store.get(dataAtom);
    expect(hydraulicModel.customerPoints.size).toBe(1);
    expect(hydraulicModel.customerPoints.get("1")?.coordinates).toEqual([
      10.5, 20.5,
    ]);
  });

  it("attaches connection data during import", async () => {
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
    await waitForWizardToOpen();
    expectWizardStep("data input");
    await uploadFileInWizard(file);
    expectWizardStep("demand options");
    await finishWizardImport();
    await expectSuccessNotification();
    const { hydraulicModel } = store.get(dataAtom);
    const customerPoint = hydraulicModel.customerPoints.get("1");

    expect(customerPoint).toBeDefined();
    expect(customerPoint!.connection).toBeDefined();
    expect(customerPoint!.connection!.pipeId).toBe("P1");
    expect(customerPoint!.connection!.snapPoint).toBeDefined();
    expect(customerPoint!.connection!.distance).toBeGreaterThan(0);
  });

  it("assigns junctions during customer point import", async () => {
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
    await waitForWizardToOpen();
    expectWizardStep("data input");
    await uploadFileInWizard(file);
    expectWizardStep("demand options");
    await finishWizardImport();
    await expectSuccessNotification();
    const { hydraulicModel } = store.get(dataAtom);
    const customerPoint = hydraulicModel.customerPoints.get("1");
    const junction = hydraulicModel.assets.get("J1") as Junction;

    expect(customerPoint!.connection!.junction).toBe(junction);
    expect(junction.customerPointCount).toBe(1);
    expect(junction.customerPoints).toContain(customerPoint);
  });

  it("assigns customer points to closest junction", async () => {
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
    await waitForWizardToOpen();
    expectWizardStep("data input");
    await uploadFileInWizard(file);
    expectWizardStep("demand options");
    await finishWizardImport();
    await expectSuccessNotification();

    const { hydraulicModel } = store.get(dataAtom);
    const customerPoint = hydraulicModel.customerPoints.get("1");
    const junction2 = hydraulicModel.assets.get("J2") as Junction;
    expect(customerPoint!.connection!.junction).toBe(junction2);
    expect(junction2.customerPointCount).toBe(1);
  });

  it("excludes tanks and reservoirs from junction assignment", async () => {
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
    await waitForWizardToOpen();
    expectWizardStep("data input");
    await uploadFileInWizard(file);
    expectWizardStep("demand options");
    await finishWizardImport();
    await expectSuccessNotification(1);

    const { hydraulicModel } = store.get(dataAtom);
    const customerPoint = hydraulicModel.customerPoints.get("1");
    const junction = hydraulicModel.assets.get("J1") as Junction;
    expect(customerPoint!.connection!.junction).toBe(junction);
    expect(junction.customerPointCount).toBe(1);
  });

  it.skip("shows unexpected error dialog when file access fails", async () => {
    const userTracking = stubUserTracking();
    const file = aTestFile({
      filename: "customer-points.geojson",
    });
    const store = createStoreWithPipes();

    renderComponent({ store });

    await triggerCommand();
    await waitForWizardToOpen();
    await uploadFileInWizard(file);

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

  it("keeps existing demands when add on top option is selected", async () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0], baseDemand: 30 })
        .aJunction("J2", { coordinates: [10, 0], baseDemand: 45 })
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
          geometry: { type: "Point", coordinates: [2, 1] },
          properties: { demand: 20 },
        },
      ],
    });

    const file = aTestFile({
      filename: "customer-points.geojson",
      content: geoJsonContent,
    });

    await triggerCommand();
    await waitForWizardToOpen();
    expectWizardStep("data input");
    await uploadFileInWizard(file);
    expectWizardStep("demand options");

    await userEvent.click(
      screen.getByLabelText(/add customer demands on top/i),
    );

    await finishWizardImport();
    await expectSuccessNotification();

    const { hydraulicModel } = store.get(dataAtom);
    const junction = hydraulicModel.assets.get("J1") as Junction;

    expect(junction.baseDemand).toBe(30);
  });

  it("closes wizard when cancel is clicked", async () => {
    const userTracking = stubUserTracking();
    const store = createStoreWithPipes();

    renderComponent({ store });

    await triggerCommand();
    await waitForWizardToOpen();

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText(/import customer/)).not.toBeInTheDocument();
    });

    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "importCustomerPoints.canceled",
    });
  });
});

const triggerCommand = async () => {
  await userEvent.click(
    screen.getByRole("button", { name: "importCustomerPoints" }),
  );
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

const waitForWizardToOpen = async () => {
  await waitFor(() =>
    screen.getByRole("navigation", { name: /import wizard steps/i }),
  );
};

const uploadFileInWizard = async (file: File) => {
  const fileInput = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  expect(fileInput).toBeInTheDocument();

  await userEvent.upload(fileInput, file);
};

const finishWizardImport = async () => {
  await userEvent.click(screen.getByRole("button", { name: /finish/i }));
};

const expectWizardStep = (stepName: string) => {
  expect(
    screen.getByRole("tab", {
      name: new RegExp(stepName, "i"),
      current: "step",
    }),
  ).toBeInTheDocument();
};

const uploadFileWithParseError = async (invalidContent: string) => {
  const file = aTestFile({
    filename: "invalid.geojson",
    content: invalidContent,
  });

  const fileInput = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  expect(fileInput).toBeInTheDocument();

  await userEvent.upload(fileInput, file);
};

const expectSuccessNotification = async (count?: number) => {
  await waitFor(() => {
    expect(screen.getByText(/import successful/i)).toBeInTheDocument();
  });
  if (count !== undefined) {
    await waitFor(() => {
      expect(
        screen.getByText(
          new RegExp(`successfully imported ${count} customer points`, "i"),
        ),
      ).toBeInTheDocument();
    });
  }
};
