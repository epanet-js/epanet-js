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

describe.skip("importCustomerPoints", () => {
  beforeEach(() => {
    toast.remove();
  });

  it("imports GeoJSON customer points correctly", async () => {
    const store = createStoreWithPipes();

    renderComponent({ store });

    const geoJsonContent = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [0.0003, 0.0003],
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
            coordinates: [0.0007, 0.0007],
          },
          properties: {
            name: "Customer B",
            type: "Commercial",
            demand: 150.0,
          },
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

    expectWizardStep("data preview");

    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    expectWizardStep("demand options");

    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    expectWizardStep("customers allocation");

    await waitForAllocations();

    await waitFor(() => {
      expect(
        screen.getByText(/2 customer points will be allocated/i),
      ).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: /apply changes/i }),
    );
    await expectSuccessNotification(2);

    const { hydraulicModel } = store.get(dataAtom);
    expect(hydraulicModel.customerPoints.size).toBe(2);

    const customerPoint1 = hydraulicModel.customerPoints.get("1");
    const customerPoint2 = hydraulicModel.customerPoints.get("2");

    expect(customerPoint1).toBeDefined();
    expect(customerPoint1?.coordinates).toEqual([0.0003, 0.0003]);
    expect(customerPoint1?.baseDemand).toBeCloseTo(0.000295, 6);

    expect(customerPoint2).toBeDefined();
    expect(customerPoint2?.coordinates).toEqual([0.0007, 0.0007]);
    expect(customerPoint2?.baseDemand).toBeCloseTo(0.00174, 5);
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

    expectWizardStep("data preview");

    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    expectWizardStep("demand options");

    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    expectWizardStep("customers allocation");

    await waitForAllocations();

    await userEvent.click(
      screen.getByRole("button", { name: /apply changes/i }),
    );
    await expectSuccessNotification();

    const { hydraulicModel } = store.get(dataAtom);
    expect(hydraulicModel.customerPoints.has("1")).toBe(true);
    expect(hydraulicModel.customerPoints.has("2")).toBe(true);
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
    expectWizardStep("data preview");

    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expectWizardStep("demand options");

    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expectWizardStep("customers allocation");

    await waitForAllocations();

    await userEvent.click(
      screen.getByRole("button", { name: /apply changes/i }),
    );
    await expectSuccessNotification(1);

    const { hydraulicModel } = store.get(dataAtom);
    expect(hydraulicModel.customerPoints.size).toBe(1);
    expect(hydraulicModel.customerPoints.get("1")?.coordinates).toEqual([
      0.0004, 0.0004,
    ]);
  });

  it("keeps existing demands when add on top option is selected", async () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0], baseDemand: 30 })
        .aJunction("J2", { coordinates: [0.001, 0.001], baseDemand: 45 })
        .aPipe("P1", {
          startNodeId: "J1",
          endNodeId: "J2",
          diameter: 150,
          coordinates: [
            [0, 0],
            [0.001, 0.001],
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
          geometry: { type: "Point", coordinates: [0.0003, 0.0003] },
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
    expectWizardStep("data preview");

    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expectWizardStep("demand options");

    await userEvent.click(
      screen.getByLabelText(/add customer demands on top/i),
    );

    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    expectWizardStep("customers allocation");

    await waitForAllocations();

    await userEvent.click(
      screen.getByRole("button", { name: /apply changes/i }),
    );
    await expectSuccessNotification();

    const { hydraulicModel } = store.get(dataAtom);
    const junction = hydraulicModel.assets.get("J1") as Junction;

    expect(junction.baseDemand).toBe(30);

    const junctionCustomerPoints =
      hydraulicModel.customerPointsLookup.getCustomerPoints("J1");
    expect(junctionCustomerPoints?.size).toBe(1);
    expect(
      junction.getTotalCustomerDemand(hydraulicModel.customerPointsLookup),
    ).toBeCloseTo(0.000231, 6);
  });

  it("replaces existing demands when replace option is selected", async () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0], baseDemand: 40 })
        .aJunction("J2", { coordinates: [0.001, 0.001], baseDemand: 60 })
        .aPipe("P1", {
          startNodeId: "J1",
          endNodeId: "J2",
          diameter: 150,
          coordinates: [
            [0, 0],
            [0.001, 0.001],
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
          geometry: { type: "Point", coordinates: [0.0002, 0.0002] },
          properties: { demand: 25 },
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
    expectWizardStep("data preview");

    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expectWizardStep("demand options");

    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    expectWizardStep("customers allocation");

    await waitForAllocations();

    await userEvent.click(
      screen.getByRole("button", { name: /apply changes/i }),
    );
    await expectSuccessNotification();

    const { hydraulicModel } = store.get(dataAtom);
    const junction = hydraulicModel.assets.get("J1") as Junction;

    expect(junction.baseDemand).toBe(0);

    const junctionCustomerPoints =
      hydraulicModel.customerPointsLookup.getCustomerPoints("J1");
    expect(junctionCustomerPoints?.size).toBe(1);
    expect(
      junction.getTotalCustomerDemand(hydraulicModel.customerPointsLookup),
    ).toBeCloseTo(0.000289, 6);
  });

  it("closes wizard when cancel is clicked", async () => {
    const userTracking = stubUserTracking();
    const store = createStoreWithPipes();

    renderComponent({ store });

    await triggerCommand();
    await waitForWizardToOpen();

    await userEvent.click(screen.getByRole("button", { name: /close/i }));

    await waitFor(() => {
      expect(screen.queryByText(/import customer/)).not.toBeInTheDocument();
    });

    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "importCustomerPoints.dataInput.cancel",
    });
  });

  it("imports valid points and skips invalid ones from mixed data", async () => {
    const store = createStoreWithPipes();

    renderComponent({ store });

    const mixedData = createMixedValidInvalidGeoJSON();
    const file = aTestFile({
      filename: "mixed-data.geojson",
      content: mixedData,
    });

    await triggerCommand();
    await waitForWizardToOpen();

    expectWizardStep("data input");

    await uploadFileInWizard(file);

    expectWizardStep("data preview");

    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    expectWizardStep("demand options");

    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    expectWizardStep("customers allocation");

    await waitForAllocations();

    await userEvent.click(
      screen.getByRole("button", { name: /apply changes/i }),
    );
    await expectSuccessNotification(2);

    const { hydraulicModel } = store.get(dataAtom);
    expect(hydraulicModel.customerPoints.size).toBe(2);
  });

  describe("warning dialog behavior", () => {
    it("shows warning when existing customer points exist", async () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .aJunction("J1", { coordinates: [0, 0] })
          .aCustomerPoint("EXISTING", {
            coordinates: [5, 5],
            demand: 100,
          })
          .build(),
      });

      renderComponent({ store });

      await triggerCommand();

      expect(screen.getByText(/permanently delete/)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Delete and Import/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Cancel" }),
      ).toBeInTheDocument();
    });

    it("opens wizard directly when no existing customer points", async () => {
      const store = createStoreWithPipes();

      renderComponent({ store });

      await triggerCommand();

      expect(screen.queryByText(/permanently delete/)).not.toBeInTheDocument();
      await waitForWizardToOpen();
      expect(
        screen.getByRole("navigation", { name: /import wizard steps/i }),
      ).toBeInTheDocument();
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
          coordinates: [0.0002, 0.0002],
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
          coordinates: [0.0008, 0.0008],
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
          coordinates: [0.0004, 0.0004],
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
            [0.001, 0.002],
            [0.003, 0.004],
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

const createMixedValidInvalidGeoJSON = (): string => {
  return JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [0.0005, 0.0005],
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
          coordinates: [0.0006, 0.0006],
        },
        properties: {
          name: "Valid Customer B",
          demand: 150,
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
          name: "Invalid Line Feature",
          demand: 100,
        },
      },
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [50],
        },
        properties: {
          name: "Invalid Coordinates",
          demand: 75,
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
          name: "Invalid Polygon",
          demand: 200,
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
    .aJunction("J2", { coordinates: [0.001, 0.001] })
    .aPipe("P1", {
      startNodeId: "J1",
      endNodeId: "J2",
      diameter: 150, // Within maxDiameter: 200 limit
      coordinates: [
        [0, 0],
        [0.001, 0.001],
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
  await waitFor(
    () => screen.getByRole("navigation", { name: /import wizard steps/i }),
    { timeout: 3000 },
  );
};

const uploadFileInWizard = async (file: File) => {
  const dropZone = screen.getByTestId("customer-points-drop-zone");
  expect(dropZone).toBeInTheDocument();

  await userEvent.click(dropZone);

  const fileInput = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  expect(fileInput).toBeInTheDocument();

  await userEvent.upload(fileInput, file);
};

const waitForAllocations = async () => {
  // Wait for allocation computation to complete
  await waitFor(() => {
    expect(
      screen.queryByText("Computing allocations..."),
    ).not.toBeInTheDocument();
  });

  // Wait for allocation summary to appear
  await waitFor(() => {
    expect(screen.getByText(/Allocation summary/)).toBeInTheDocument();
  });
};

const expectWizardStep = (stepName: string) => {
  expect(
    screen.getByRole("tab", {
      name: new RegExp(stepName, "i"),
      current: "step",
    }),
  ).toBeInTheDocument();
};

const expectSuccessNotification = async (count?: number) => {
  await waitFor(() => {
    expect(screen.getByText(/import successful/i)).toBeInTheDocument();
  });
  if (count !== undefined) {
    await waitFor(() => {
      expect(screen.getByText(/import successful/i)).toBeInTheDocument();
    });
  }
};
