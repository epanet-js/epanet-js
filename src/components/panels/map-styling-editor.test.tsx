import { screen, render, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { aLayerConfig, setInitialState } from "src/__helpers__/state";
import { MapStylingEditor } from "./map-styling-editor";
import { Store } from "src/state/jotai";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { LayerConfigMap } from "src/types";
import { AuthMockProvider, aGuestUser, aUser } from "src/__helpers__/auth-mock";
import { Dialogs } from "../dialogs";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import { QueryClient, QueryClientProvider } from "react-query";

describe("Map Styling Editor", () => {
  it("can change the styles for nodes", async () => {
    const user = userEvent.setup();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { elevation: 10 })
      .aJunction("J2", { elevation: 15 })
      .build();
    const store = setInitialState({
      hydraulicModel,
    });
    renderComponent(store);

    expect(
      screen.getByRole("combobox", { name: /node color by/i }),
    ).toHaveTextContent("None");

    await user.click(screen.getByRole("combobox", { name: /node color by/i }));
    await user.click(screen.getByText("Elevation"));

    expect(
      screen.getByRole("button", { name: /pretty breaks, 5/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /pretty breaks, 5/i }));

    await user.click(screen.getByRole("combobox", { name: /mode/i }));
    await user.click(screen.getByRole("option", { name: /equal intervals/i }));

    await user.click(screen.getByRole("combobox", { name: /classes/i }));
    await user.click(screen.getByRole("option", { name: "4" }));

    expect(
      screen.getByRole("button", { name: /equal intervals, 4/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: /node ramp/i }));
    await user.click(screen.getByTitle("OrRd"));
    await user.keyboard("{Escape}");

    await userEvent.click(
      screen.getByRole("checkbox", { name: /node labels/i }),
    );

    expect(
      screen.getByRole("checkbox", { name: /node labels/i }),
    ).toBeChecked();
  });

  it("can change the styles for links", async () => {
    const user = userEvent.setup();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe("P1", { diameter: 10 })
      .aPipe("P2", { diameter: 15 })
      .build();
    const store = setInitialState({
      hydraulicModel,
    });
    renderComponent(store);

    expect(
      screen.getByRole("combobox", { name: /link color by/i }),
    ).toHaveTextContent("None");

    await user.click(screen.getByRole("combobox", { name: /link color by/i }));
    await user.click(screen.getByText("Diameter"));

    expect(
      screen.getByRole("button", { name: /pretty breaks, 7/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /pretty breaks, 7/i }));

    await user.click(screen.getByRole("combobox", { name: /mode/i }));
    await user.click(screen.getByRole("option", { name: /equal intervals/i }));

    await user.click(screen.getByRole("combobox", { name: /classes/i }));
    await user.click(screen.getByRole("option", { name: "4" }));

    expect(
      screen.getByRole("button", { name: /equal intervals, 4/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: /link ramp/i }));
    await user.click(screen.getByTitle("OrRd"));
    await user.keyboard("{Escape}");

    await userEvent.click(
      screen.getByRole("checkbox", { name: /link labels/i }),
    );

    expect(
      screen.getByRole("checkbox", { name: /link labels/i }),
    ).toBeChecked();
  });

  it("can reverse ramp colors", async () => {
    const user = userEvent.setup();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe("P1", { diameter: 10 })
      .aPipe("P2", { diameter: 15 })
      .build();
    const store = setInitialState({
      hydraulicModel,
    });
    renderComponent(store);

    await user.click(screen.getByRole("combobox", { name: /link color by/i }));
    await user.click(screen.getByText("Diameter"));
    await user.click(screen.getByRole("combobox", { name: /link ramp/i }));
    await user.click(screen.getByTitle("OrRd"));
    await user.click(screen.getByText(/reverse colors/i));
    await user.keyboard("{Escape}");

    expect(screen.getByTitle("OrRd reversed")).toBeInTheDocument();
  });

  it("disables options that need a simulation", async () => {
    const user = userEvent.setup();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe("P1")
      .aPipe("P2")
      .aJunction("J1")
      .aJunction("J2")
      .build();
    const store = setInitialState({
      hydraulicModel,
    });
    renderComponent(store);

    await user.click(screen.getByRole("combobox", { name: /link color by/i }));
    expect(screen.getByRole("option", { name: /flow/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("combobox", { name: /node color by/i }));
    expect(screen.getByRole("option", { name: /pressure/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  describe("layers", () => {
    it("can change basemap from the dropdown", async () => {
      const basemap = aLayerConfig({
        type: "MAPBOX",
        isBasemap: true,
        name: "Streets",
      });
      const layerConfigs: LayerConfigMap = new Map();
      layerConfigs.set(basemap.id, basemap);

      const store = setInitialState({ layerConfigs });
      renderComponent(store);

      expect(screen.getByText(/BASEMAP/)).toBeInTheDocument();
      expect(screen.getByText(/Streets/)).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole("combobox", { name: /basemaps/i }),
      );
      await userEvent.click(screen.getByText("Monochrome"));

      expect(screen.getByText(/BASEMAP/)).toBeInTheDocument();
      expect(screen.getByText(/Monochrome/)).toBeInTheDocument();
    });

    it("can change basemap from add custom", async () => {
      const basemap = aLayerConfig({
        type: "MAPBOX",
        isBasemap: true,
        name: "Streets",
      });
      const layerConfigs: LayerConfigMap = new Map();
      layerConfigs.set(basemap.id, basemap);

      const store = setInitialState({ layerConfigs });
      renderComponent(store);

      await userEvent.click(
        screen.getByRole("button", { name: /add custom/i }),
      );
      await userEvent.click(screen.getByText("Basemap"));
      await userEvent.click(screen.getByText("Monochrome"));

      expect(screen.getByText(/BASEMAP/)).toBeInTheDocument();
      expect(screen.getByText(/Monochrome/)).toBeInTheDocument();
    });

    it("can change the visibility", async () => {
      const basemap = aLayerConfig({
        type: "MAPBOX",
        isBasemap: true,
        name: "Streets",
      });
      const layerConfigs: LayerConfigMap = new Map();
      layerConfigs.set(basemap.id, basemap);

      const store = setInitialState({ layerConfigs });
      renderComponent(store);

      await userEvent.click(
        screen.getByRole("checkbox", { name: /toggle visibility/i }),
      );

      expect(
        screen.getByRole("checkbox", { name: /toggle visibility/i }),
      ).not.toBeChecked();

      await userEvent.click(
        screen.getByRole("checkbox", { name: /toggle visibility/i }),
      );

      expect(
        screen.getByRole("checkbox", { name: /toggle visibility/i }),
      ).toBeChecked();
    });

    it("can change the labels visibility", async () => {
      const basemap = aLayerConfig({
        type: "MAPBOX",
        isBasemap: true,
        name: "Streets",
      });
      const layerConfigs: LayerConfigMap = new Map();
      layerConfigs.set(basemap.id, basemap);

      const store = setInitialState({ layerConfigs });
      renderComponent(store);

      await userEvent.click(
        screen.getByRole("checkbox", { name: /toggle labels visibility/i }),
      );

      expect(
        screen.getByRole("checkbox", { name: /toggle labels visibility/i }),
      ).not.toBeChecked();

      await userEvent.click(
        screen.getByRole("checkbox", { name: /toggle labels visibility/i }),
      );
      expect(
        screen.getByRole("checkbox", { name: /toggle labels visibility/i }),
      ).toBeChecked();
    });

    it("blocks custom layers to free users", async () => {
      stubFeatureOn("FLAG_UPGRADE");
      const basemap = aLayerConfig({
        type: "MAPBOX",
        isBasemap: true,
        name: "Streets",
      });
      const layerConfigs: LayerConfigMap = new Map();
      layerConfigs.set(basemap.id, basemap);

      const store = setInitialState({ layerConfigs });
      renderComponent(store, aUser({ plan: "free" }));

      await userEvent.click(
        screen.getByRole("button", { name: /add custom/i }),
      );
      expect(screen.getAllByText(/upgrade/i)).toHaveLength(3);

      await userEvent.click(screen.getByText(/XYZ/));

      expect(
        await screen.findByText(/upgrade your account/i),
      ).toBeInTheDocument();
    });

    it("can add custom XYZ layer when not in free", async () => {
      stubFeatureOn("FLAG_SKIP_LAYER_VALIDATION");
      const basemap = aLayerConfig({
        type: "MAPBOX",
        isBasemap: true,
        name: "Streets",
      });
      const layerConfigs: LayerConfigMap = new Map();
      layerConfigs.set(basemap.id, basemap);

      const store = setInitialState({ layerConfigs });
      renderComponent(store, aUser({ plan: "pro" }));

      await userEvent.click(
        screen.getByRole("button", { name: /add custom/i }),
      );
      expect(screen.queryByText(/upgrade/i)).not.toBeInTheDocument();

      await userEvent.click(screen.getByText(/XYZ/));

      await userEvent.type(
        screen.getByRole("textbox", { name: /name/i }),
        "My custom XYZ",
      );

      await userEvent.type(
        screen.getByRole("textbox", { name: /url/i }),
        anXYZUrl,
      );
      await userEvent.click(screen.getByRole("button", { name: /add layer/i }));

      await waitFor(() => {
        expect(screen.getByText(/My custom XYZ/i)).toBeInTheDocument();
      });
    });

    it("can add custom tilejson when not in free", async () => {
      stubFeatureOn("FLAG_SKIP_LAYER_VALIDATION");
      const basemap = aLayerConfig({
        type: "MAPBOX",
        isBasemap: true,
        name: "Streets",
      });
      const layerConfigs: LayerConfigMap = new Map();
      layerConfigs.set(basemap.id, basemap);

      const store = setInitialState({ layerConfigs });
      renderComponent(store, aUser({ plan: "pro" }));

      await userEvent.click(
        screen.getByRole("button", { name: /add custom/i }),
      );
      expect(screen.queryByText(/upgrade/i)).not.toBeInTheDocument();

      await userEvent.click(screen.getByText(/tilejson/i));

      await userEvent.type(
        screen.getByRole("textbox", { name: /name/i }),
        "My custom layer",
      );
      await userEvent.type(
        screen.getByRole("textbox", { name: /url/i }),
        aTileJSONUrl,
      );

      await userEvent.click(screen.getByRole("button", { name: /add layer/i }));

      await waitFor(() => {
        expect(screen.getByText(/My custom layer/i)).toBeInTheDocument();
        expect(screen.getByText(/TILEJSON/)).toBeInTheDocument();
      });
    });

    it.skip("can add custom mapbox layer when not in free", async () => {
      stubFeatureOn("FLAG_SKIP_LAYER_VALIDATION");
      const basemap = aLayerConfig({
        type: "MAPBOX",
        isBasemap: true,
        name: "Streets",
      });
      const layerConfigs: LayerConfigMap = new Map();
      layerConfigs.set(basemap.id, basemap);

      const store = setInitialState({ layerConfigs });
      renderComponent(store, aUser({ plan: "pro" }));

      await userEvent.click(
        screen.getByRole("button", { name: /add custom/i }),
      );
      expect(screen.queryByText(/upgrade/i)).not.toBeInTheDocument();

      await userEvent.click(screen.getByText(/mapbox/i));

      await userEvent.type(
        screen.getByRole("textbox", { name: /url/i }),
        aMabpoxUrl,
      );

      await userEvent.type(
        screen.getByRole("textbox", { name: /token/i }),
        process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string,
      );
      await userEvent.click(screen.getByRole("button", { name: /add layer/i }));

      await waitFor(() => {
        expect(screen.queryByText(/add layer/i)).not.toBeInTheDocument();
      });
    });
  });

  const renderComponent = (store: Store, user = aGuestUser()) => {
    return render(
      <AuthMockProvider user={user} isSignedIn={user.id !== null}>
        <QueryClientProvider client={new QueryClient()}>
          <JotaiProvider store={store}>
            <TooltipProvider>
              <Dialogs></Dialogs>
              <MapStylingEditor />
            </TooltipProvider>
          </JotaiProvider>
        </QueryClientProvider>
      </AuthMockProvider>,
    );
  };
});
const aTileJSONUrl =
  "https://api.maptiler.com/maps/hybrid/tiles.json?key=UnwFuxTzMjQ3MdGKVK2G";
const anXYZUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`;
const aMabpoxUrl = "mapbox://styles/mapbox/navigation-guidance-day-v4";
