import type { Feature } from "geojson";
import shp from "shpjs";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defaultProjectSettings } from "@epanet-js/project-settings";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { stubProjectionsReady } from "src/__helpers__/projections";
import { projectSettingsAtom } from "src/state/project-settings";
import { Store } from "src/state";
import { setWizardState } from "./__helpers__/wizard-state";
import { renderWizard } from "./__helpers__/render-wizard";

const aPoint = (coordinates: [number, number], meter: string): Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates },
  properties: { METER: meter },
});

const aFile = (features: Feature[]) =>
  new File(
    [JSON.stringify({ type: "FeatureCollection", features })],
    "customers.geojson",
    { type: "application/json" },
  );

const unprojected = (centroid: [number, number]) => ({
  ...defaultProjectSettings,
  projection: {
    type: "xy-grid" as const,
    id: "xy-grid",
    name: "XY Grid",
    centroid,
  },
});

const renderAt = (store: Store, features: Feature[]) => {
  const file = aFile(features);

  setWizardState(store, {
    sourceFiles: [file],
    inputData: { properties: new Set(["METER"]) },
  });
  renderWizard(store);
};

vi.mock("shpjs");

const aShapefileBundle = () => [
  new File([""], "customers.shp"),
  new File([""], "customers.dbf"),
  new File(['GEOGCS["WGS 84"]'], "customers.prj"),
];

describe("customer points wizard, on the importer", () => {
  beforeEach(() => {
    stubUserTracking();
    stubProjectionsReady();
  });

  it("reads a file through the importer", async () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });

    renderAt(store, [
      aPoint([0.001, 0.001], "M-1"),
      aPoint([0.002, 0.002], "M-2"),
    ]);

    await waitFor(() => {
      expect(screen.getByText(/Customer points \(2\)/)).toBeInTheDocument();
    });
  });

  it("reads a shapefile from every file of its bundle", async () => {
    vi.mocked(shp).mockResolvedValue({
      type: "FeatureCollection",
      features: [aPoint([0.001, 0.001], "M-1"), aPoint([0.002, 0.002], "M-2")],
    });
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });
    const bundle = aShapefileBundle();

    setWizardState(store, {
      sourceFiles: bundle,
      inputData: { properties: new Set(["METER"]) },
    });
    renderWizard(store);

    await waitFor(() => {
      expect(screen.getByText(/Customer points \(2\)/)).toBeInTheDocument();
    });
  });

  it("reads a table, finding its coordinates again on the second parse", async () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });
    const csv = new File(
      [
        ["METER,Longitude,Latitude", "M-1,0.001,0.001", "M-2,0.002,0.002"].join(
          "\n",
        ),
      ],
      "customers.csv",
      { type: "text/csv" },
    );

    setWizardState(store, {
      sourceFiles: [csv],
      inputData: { properties: new Set(["METER"]) },
    });
    renderWizard(store);

    await waitFor(() => {
      expect(screen.getByText(/Customer points \(2\)/)).toBeInTheDocument();
    });
  });

  describe("a table that does not name its coordinates", () => {
    const anUnnamedCsv = (rows: string[]) =>
      new File([["METER,First,Second", ...rows].join("\n")], "customers.csv", {
        type: "text/csv",
      });

    const renderAwaiting = (store: Store, rows: string[]) => {
      setWizardState(store, {
        sourceFiles: [anUnnamedCsv(rows)],
        inputData: {
          properties: new Set(["METER", "First", "Second"]),
          needsCoordinates: true,
        },
      });
      renderWizard(store);
    };

    const nameAttributes = async (x: string, y: string) => {
      for (const [axis, property] of [
        [/longitude \/ x/i, x],
        [/latitude \/ y/i, y],
      ] as const) {
        await userEvent.click(screen.getByRole("combobox", { name: axis }));
        await userEvent.click(
          await screen.findByRole("option", { name: property }),
        );
      }
    };

    it("reads nothing until the attributes are named", () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      renderAwaiting(store, ["M-1,0.001,0.001"]);

      expect(screen.queryByText(/Customer points \(/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    });

    it("reads the points once they are named", async () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      renderAwaiting(store, ["M-1,0.001,0.001", "M-2,0.002,0.002"]);
      await nameAttributes("First", "Second");

      await waitFor(() => {
        expect(screen.getByText(/Customer points \(2\)/)).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: /next/i })).toBeEnabled();
    });

    it("says nothing while only some of the mapping is chosen", async () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      renderAwaiting(store, ["M-1,0.001,0.001"]);

      await userEvent.click(screen.getByRole("combobox", { name: /label/i }));
      await userEvent.click(
        await screen.findByRole("option", { name: "METER" }),
      );
      await userEvent.click(
        screen.getByRole("combobox", { name: /longitude \/ x/i }),
      );
      await userEvent.click(
        await screen.findByRole("option", { name: "First" }),
      );

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(
        screen.queryByText(/No coordinates could be read/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/All coordinates must be expressed in WGS84/i),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();

      await userEvent.click(
        screen.getByRole("combobox", { name: /latitude \/ y/i }),
      );
      await userEvent.click(
        await screen.findByRole("option", { name: "Second" }),
      );

      await waitFor(() => {
        expect(screen.getByText(/Customer points \(1\)/)).toBeInTheDocument();
      });
    });

    it("asks for WGS84 when the named attributes are not in degrees", async () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      renderAwaiting(store, ["M-1,500000,6000000", "M-2,500100,6000100"]);
      await nameAttributes("First", "Second");

      await waitFor(() => {
        expect(
          screen.getByText(/All coordinates must be expressed in WGS84/i),
        ).toBeInTheDocument();
      });
      expect(screen.queryByText(/Customer points \(/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    });

    it("refuses attributes that hold no coordinates at all", async () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        sourceFiles: [
          new File(
            [["METER,First,Second", "M-1,north,west"].join("\n")],
            "customers.csv",
            { type: "text/csv" },
          ),
        ],
        inputData: {
          properties: new Set(["METER", "First", "Second"]),
          needsCoordinates: true,
        },
      });
      renderWizard(store);
      await nameAttributes("METER", "First");

      await waitFor(() => {
        expect(
          screen.getByText(/No coordinates could be read/i),
        ).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    });

    it("recovers once better attributes are named", async () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      setWizardState(store, {
        sourceFiles: [
          new File(
            [
              ["METER,Easting,First,Second", "M-1,500000,0.001,0.001"].join(
                "\n",
              ),
            ],
            "customers.csv",
            { type: "text/csv" },
          ),
        ],
        inputData: {
          properties: new Set(["METER", "Easting", "First", "Second"]),
          needsCoordinates: true,
        },
      });
      renderWizard(store);

      await nameAttributes("Easting", "Second");
      await waitFor(() => {
        expect(
          screen.getByText(/All coordinates must be expressed in WGS84/i),
        ).toBeInTheDocument();
      });

      await userEvent.click(
        screen.getByRole("combobox", { name: /longitude \/ x/i }),
      );
      await userEvent.click(
        await screen.findByRole("option", { name: "First" }),
      );

      await waitFor(() => {
        expect(screen.getByText(/Customer points \(1\)/)).toBeInTheDocument();
      });
      expect(
        screen.queryByText(/All coordinates must be expressed in WGS84/i),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /next/i })).toBeEnabled();
    });
  });

  it("refuses local coordinates in a model that is not georeferenced either", async () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });
    store.set(projectSettingsAtom, unprojected([1000, 2000]));

    renderAt(store, [aPoint([1000, 2000], "M-1"), aPoint([1200, 2400], "M-2")]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    });
    expect(screen.queryByText(/Customer points \(2\)/)).not.toBeInTheDocument();
  });

  it("refuses them in a georeferenced model", async () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });

    renderAt(store, [
      aPoint([432000, 5812000], "M-1"),
      aPoint([433000, 5813000], "M-2"),
    ]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    });
    expect(screen.queryByText(/Customer points \(2\)/)).not.toBeInTheDocument();
  });
});
