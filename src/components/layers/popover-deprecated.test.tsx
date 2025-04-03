import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "react-query";
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
import { AuthProvider } from "src/auth";

describe("layers popover", () => {
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

  const findLayer = (layerConfigs: LayerConfigMap, name: string) => {
    return [...layerConfigs.values()].find(
      (l) => l.name === name,
    ) as ILayerConfig;
  };

  const hasLayer = (layerConfigs: LayerConfigMap, name: string) => {
    return [...layerConfigs.values()].find((l) => l.name === name);
  };

  const renderComponent = ({ store }: { store: Store }) => {
    render(
      <Container store={store}>
        <LayersPopover onClose={() => {}} />
      </Container>,
    );
  };

  const Container = ({
    store,
    children,
  }: {
    store: Store;
    children: React.ReactNode;
  }) => {
    const idMap = UIDMap.empty();
    return (
      <AuthProvider>
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
      </AuthProvider>
    );
  };
});
