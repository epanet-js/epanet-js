import "src/__helpers__/media-queries";
import { screen, render } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { setInitialState } from "src/__helpers__/state";
import { Store } from "src/state";
import userEvent from "@testing-library/user-event";
import { AuthMockProvider, aGuestUser } from "src/__helpers__/auth-mock";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { stubWindowSize } from "src/__helpers__/media-queries";
import { ElevationsConfig } from "./elevations-config";
import { elevationSourcesAtom } from "src/state/elevation-sources";
import type {
  GeoTiffElevationSource,
  TileServerElevationSource,
} from "src/lib/elevations";

const aMapboxSource: TileServerElevationSource = {
  type: "tile-server",
  id: "mapbox-default",
  enabled: true,
  name: "Mapbox default data",
  tileUrlTemplate:
    "https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}@2x.pngraw",
  tileZoom: 14,
  tileSize: 512,
  encoding: "terrain-rgb",
  elevationOffsetM: 0,
};

const aGeoTiffSource: GeoTiffElevationSource = {
  type: "geotiff",
  id: "user-dtm-1",
  enabled: true,
  name: "User elevation data",
  tiles: [
    {
      id: "tile-1",
      fileName: "o41078a1.tif",
      fileSize: 1024,
      width: 100,
      height: 100,
      bbox: [-4.0, 55.0, -3.0, 56.0],
      pixelToGps: [0, 1, 0, 0, 0, 1],
      gpsToPixel: [0, 1, 0, 0, 0, 1],
      noDataValue: -9999,
    },
    {
      id: "tile-2",
      fileName: "o41078a2.tif",
      fileSize: 2048,
      width: 100,
      height: 100,
      bbox: [-3.0, 55.0, -2.0, 56.0],
      pixelToGps: [0, 1, 0, 0, 0, 1],
      gpsToPixel: [0, 1, 0, 0, 0, 1],
      noDataValue: -9999,
    },
  ],
  elevationOffsetM: 0,
};

describe("ElevationsConfig", () => {
  beforeEach(() => {
    stubWindowSize("sm");
    localStorage.clear();
  });

  it("renders the default Mapbox source", () => {
    const store = setInitialState({});
    store.set(elevationSourcesAtom, [aMapboxSource]);
    renderComponent(store);

    expect(screen.getByText("Mapbox default data")).toBeInTheDocument();
    expect(screen.getByText("GLOBAL DTM")).toBeInTheDocument();
  });

  it("renders a GeoTiff source with its name", () => {
    const store = setInitialState({});
    store.set(elevationSourcesAtom, [aMapboxSource, aGeoTiffSource]);
    renderComponent(store);

    expect(screen.getByText("User elevation data")).toBeInTheDocument();
    expect(screen.getByText("GEOTIFF")).toBeInTheDocument();
  });

  it("displays sources in reverse order (default at bottom)", () => {
    const store = setInitialState({});
    store.set(elevationSourcesAtom, [aMapboxSource, aGeoTiffSource]);
    renderComponent(store);

    const labels = screen.getAllByText(/GEOTIFF|GLOBAL DTM/);
    expect(labels[0]).toHaveTextContent("GEOTIFF");
    expect(labels[1]).toHaveTextContent("GLOBAL DTM");
  });

  it("shows tile filenames in the GeoTiff popover", async () => {
    const user = userEvent.setup();
    const store = setInitialState({});
    store.set(elevationSourcesAtom, [aMapboxSource, aGeoTiffSource]);
    renderComponent(store);

    const configButtons = screen.getAllByRole("button");
    const geotiffConfigButton = configButtons.find((btn) =>
      btn.closest("[class*='py-2']")?.textContent?.includes("GEOTIFF"),
    );
    expect(geotiffConfigButton).toBeDefined();
    await user.click(geotiffConfigButton!);

    expect(screen.getByText("o41078a1.tif")).toBeInTheDocument();
    expect(screen.getByText("o41078a2.tif")).toBeInTheDocument();
  });

  it("updates the elevation offset for a source", async () => {
    const user = userEvent.setup();
    const store = setInitialState({});
    store.set(elevationSourcesAtom, [aMapboxSource, aGeoTiffSource]);
    renderComponent(store);

    const configButtons = screen.getAllByRole("button");
    const geotiffConfigButton = configButtons.find((btn) =>
      btn.closest("[class*='py-2']")?.textContent?.includes("GEOTIFF"),
    );
    await user.click(geotiffConfigButton!);

    const offsetInput = screen.getByRole("textbox", {
      name: /projection offset/i,
    });
    await user.clear(offsetInput);
    await user.type(offsetInput, "5");
    await user.tab();

    const sources = store.get(elevationSourcesAtom);
    const updatedSource = sources.find((s) => s.id === "user-dtm-1");
    expect(updatedSource?.elevationOffsetM).toBe(5);
  });

  it("renders the add new elevation data button", () => {
    const store = setInitialState({});
    store.set(elevationSourcesAtom, [aMapboxSource]);
    renderComponent(store);

    expect(
      screen.getByRole("button", { name: /add new elevation data/i }),
    ).toBeInTheDocument();
  });

  const renderComponent = (store: Store) => {
    return render(
      <AuthMockProvider user={aGuestUser()} isSignedIn={false}>
        <QueryClientProvider client={new QueryClient()}>
          <JotaiProvider store={store}>
            <TooltipProvider>
              <ElevationsConfig />
            </TooltipProvider>
          </JotaiProvider>
        </QueryClientProvider>
      </AuthMockProvider>,
    );
  };
});
