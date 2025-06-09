import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UIDMap } from "src/lib/id_mapper";
import { Store, layerConfigAtom } from "src/state/jotai";
import { Provider as JotaiProvider } from "jotai";
import { PersistenceContext } from "src/lib/persistence/context";
import { Dialogs } from "../dialogs";
import Notifications from "../notifications";
import { MemPersistence } from "src/lib/persistence/memory";
import { aLayerConfig, setInitialState } from "src/__helpers__/state";
import { LayersPopover } from "./popover";
import { ILayerConfig, LayerConfigMap } from "src/types";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import { AuthMockProvider, aGuestUser, aUser } from "src/__helpers__/auth-mock";
import { User } from "src/auth-types";

describe.skip("layers popover", () => {
  beforeEach(() => {
    stubFeatureOn("FLAG_UPGRADE");
  });

  it("shows selected basemap", () => {
    const basemap = aLayerConfig({
      type: "MAPBOX",
      isBasemap: true,
      name: "Streets",
    });
    const layerConfigs: LayerConfigMap = new Map();
    layerConfigs.set(basemap.id, basemap);

    const store = setInitialState({ layerConfigs });
    renderComponent({ store });

    expect(screen.getByText(/BASEMAP/)).toBeInTheDocument();
    expect(screen.getByText(/Streets/)).toBeInTheDocument();
  });

  it("can change basemap from the dropdown", async () => {
    const basemap = aLayerConfig({
      type: "MAPBOX",
      isBasemap: true,
      name: "Streets",
    });
    const layerConfigs: LayerConfigMap = new Map();
    layerConfigs.set(basemap.id, basemap);

    const store = setInitialState({ layerConfigs });
    renderComponent({ store });

    await userEvent.click(screen.getByRole("combobox", { name: /basemaps/i }));
    await userEvent.click(screen.getByText("Monochrome"));

    expect(screen.getByText(/BASEMAP/)).toBeInTheDocument();
    expect(screen.getByText(/Monochrome/)).toBeInTheDocument();
    const updatedLayerConfigs = store.get(layerConfigAtom);
    expect(hasLayer(updatedLayerConfigs, "Monochrome"));
    expect(screen.getByText(/basemap changed/i)).toBeInTheDocument();
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
    renderComponent({ store });

    await userEvent.click(screen.getByRole("button", { name: /add custom/i }));
    await userEvent.click(screen.getByText("Basemap"));
    await userEvent.click(screen.getByText("Monochrome"));

    expect(screen.getByText(/BASEMAP/)).toBeInTheDocument();
    expect(screen.getByText(/Monochrome/)).toBeInTheDocument();
    const updatedLayerConfigs = store.get(layerConfigAtom);
    expect(hasLayer(updatedLayerConfigs, "Monochrome"));
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
    renderComponent({ store });

    await userEvent.click(
      screen.getByRole("checkbox", { name: /toggle visibility/i }),
    );

    let updatedLayerConfigs = store.get(layerConfigAtom);
    let updatedLayer = findLayer(updatedLayerConfigs, "Streets");
    expect(updatedLayer.visibility).toEqual(false);

    await userEvent.click(
      screen.getByRole("checkbox", { name: /toggle visibility/i }),
    );

    updatedLayerConfigs = store.get(layerConfigAtom);
    updatedLayer = findLayer(updatedLayerConfigs, "Streets");
    expect(updatedLayer.visibility).toEqual(true);
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
    renderComponent({ store });

    await userEvent.click(
      screen.getByRole("checkbox", { name: /toggle labels visibility/i }),
    );

    let updatedLayerConfigs = store.get(layerConfigAtom);
    let updatedLayer = findLayer(updatedLayerConfigs, "Streets");
    expect(updatedLayer.labelVisibility).toEqual(false);

    await userEvent.click(
      screen.getByRole("checkbox", { name: /toggle labels visibility/i }),
    );

    updatedLayerConfigs = store.get(layerConfigAtom);
    updatedLayer = findLayer(updatedLayerConfigs, "Streets");
    expect(updatedLayer.labelVisibility).toEqual(true);
  });

  it("blocks custom layers to free users", async () => {
    const basemap = aLayerConfig({
      type: "MAPBOX",
      isBasemap: true,
      name: "Streets",
    });
    const layerConfigs: LayerConfigMap = new Map();
    layerConfigs.set(basemap.id, basemap);

    const store = setInitialState({ layerConfigs });
    renderComponent({ store, user: aUser({ plan: "free" }) });

    await userEvent.click(screen.getByRole("button", { name: /add custom/i }));
    expect(screen.getAllByText(/upgrade/i)).toHaveLength(3);

    await userEvent.click(screen.getByText(/XYZ/));

    expect(
      await screen.findByText(/upgrade your account/i),
    ).toBeInTheDocument();
  });

  it("can add custom XYZ layer when not in free", async () => {
    const basemap = aLayerConfig({
      type: "MAPBOX",
      isBasemap: true,
      name: "Streets",
    });
    const layerConfigs: LayerConfigMap = new Map();
    layerConfigs.set(basemap.id, basemap);

    const store = setInitialState({ layerConfigs });
    renderComponent({ store, user: aUser({ plan: "pro" }) });

    await userEvent.click(screen.getByRole("button", { name: /add custom/i }));
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

    expect(screen.getByText(/Layer added/)).toBeInTheDocument();
  });

  it("can add custom mapbox layer when not in free", async () => {
    const basemap = aLayerConfig({
      type: "MAPBOX",
      isBasemap: true,
      name: "Streets",
    });
    const layerConfigs: LayerConfigMap = new Map();
    layerConfigs.set(basemap.id, basemap);

    const store = setInitialState({ layerConfigs });
    renderComponent({ store, user: aUser({ plan: "pro" }) });

    await userEvent.click(screen.getByRole("button", { name: /add custom/i }));
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

    expect(screen.getByText(/Layer added/)).toBeInTheDocument();
  });

  it("can add custom tilejson layer when not in free", async () => {
    const basemap = aLayerConfig({
      type: "MAPBOX",
      isBasemap: true,
      name: "Streets",
    });
    const layerConfigs: LayerConfigMap = new Map();
    layerConfigs.set(basemap.id, basemap);

    const store = setInitialState({ layerConfigs });
    renderComponent({ store, user: aUser({ plan: "pro" }) });

    await userEvent.click(screen.getByRole("button", { name: /add custom/i }));
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

    expect(screen.getByText(/Layer added/)).toBeInTheDocument();
  });
  const findLayer = (layerConfigs: LayerConfigMap, name: string) => {
    return [...layerConfigs.values()].find(
      (l) => l.name === name,
    ) as ILayerConfig;
  };

  const hasLayer = (layerConfigs: LayerConfigMap, name: string) => {
    return [...layerConfigs.values()].find((l) => l.name === name);
  };

  const renderComponent = ({
    store,
    user = aGuestUser(),
  }: {
    store: Store;
    user?: User;
  }) => {
    render(
      <Container store={store} user={user}>
        <LayersPopover onClose={() => {}} />
      </Container>,
    );
  };

  const Container = ({
    store,
    user,
    children,
  }: {
    store: Store;
    user: User;
    children: React.ReactNode;
  }) => {
    const idMap = UIDMap.empty();
    return (
      <AuthMockProvider user={user} isSignedIn={user.id !== null}>
        <QueryClientProvider client={new QueryClient()}>
          <JotaiProvider store={store}>
            <TooltipProvider>
              <PersistenceContext.Provider
                value={new MemPersistence(idMap, store)}
              >
                <Dialogs></Dialogs>
                <Notifications duration={1} successDuration={1} />
                {children}
              </PersistenceContext.Provider>
            </TooltipProvider>
          </JotaiProvider>
        </QueryClientProvider>
      </AuthMockProvider>
    );
  };
});

const anXYZUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`;
const aMabpoxUrl = "mapbox://styles/mapbox/navigation-guidance-day-v4";
const aTileJSONUrl =
  "https://api.maptiler.com/maps/hybrid/tiles.json?key=UnwFuxTzMjQ3MdGKVK2G";
