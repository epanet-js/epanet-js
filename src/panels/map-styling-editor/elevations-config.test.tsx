import "src/__helpers__/media-queries";
import { screen, render, waitFor } from "@testing-library/react";
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
import { extractGeoTiffMetadata } from "src/lib/elevations";
import type { GeoTIFFImage } from "geotiff";

const mockImage = {} as GeoTIFFImage;

vi.mock("src/lib/elevations", async (importOriginal) => {
  const original = await importOriginal<typeof import("src/lib/elevations")>();
  return {
    ...original,
    extractGeoTiffMetadata: vi.fn(),
  };
});

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
      file: new File([""], "o41078a1.tif"),
      width: 100,
      height: 100,
      bbox: [-4.0, 55.0, -3.0, 56.0],
      pixelToGps: [0, 1, 0, 0, 0, 1],
      gpsToPixel: [0, 1, 0, 0, 0, 1],
      noDataValue: -9999,
      image: mockImage,
    },
    {
      id: "tile-2",
      file: new File([""], "o41078a2.tif"),
      width: 100,
      height: 100,
      bbox: [-3.0, 55.0, -2.0, 56.0],
      pixelToGps: [0, 1, 0, 0, 0, 1],
      gpsToPixel: [0, 1, 0, 0, 0, 1],
      noDataValue: -9999,
      image: mockImage,
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

  it("deletes a geotiff source when clicking the delete button", async () => {
    const user = userEvent.setup();
    const store = setInitialState({});
    store.set(elevationSourcesAtom, [aMapboxSource, aGeoTiffSource]);
    renderComponent(store);

    const geotiffRow = screen.getByText("GEOTIFF").closest("[class*='py-2']")!;
    const deleteButton = geotiffRow.querySelector(".text-red-500")!;
    await user.click(deleteButton);

    const sources = store.get(elevationSourcesAtom);
    expect(sources).toHaveLength(1);
    expect(sources[0].type).toBe("tile-server");
  });

  it("adds a geotiff source when files are selected", async () => {
    const user = userEvent.setup();
    const store = setInitialState({});
    store.set(elevationSourcesAtom, [aMapboxSource]);

    vi.mocked(extractGeoTiffMetadata).mockResolvedValue({
      file: new File([""], "terrain.tif"),
      width: 200,
      height: 200,
      bbox: [-4.0, 55.0, -3.0, 56.0],
      pixelToGps: [0, 1, 0, 0, 0, 1],
      gpsToPixel: [0, 1, 0, 0, 0, 1],
      noDataValue: -9999,
      image: mockImage,
    });

    renderComponent(store);

    const file = new File([""], "terrain.tif", { type: "image/tiff" });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => {
      const sources = store.get(elevationSourcesAtom);
      expect(sources).toHaveLength(2);
      const geotiffSource = sources.find((s) => s.type === "geotiff");
      expect(geotiffSource).toBeDefined();
      expect(geotiffSource!.type).toBe("geotiff");
    });

    const geotiffSource = store
      .get(elevationSourcesAtom)
      .find((s) => s.type === "geotiff") as GeoTiffElevationSource;
    expect(geotiffSource.tiles).toHaveLength(1);
    expect(geotiffSource.tiles[0].file.name).toBe("terrain.tif");
    expect(geotiffSource.elevationOffsetM).toBe(0);
  });

  it("adds multiple tiles to a single source when selecting multiple files", async () => {
    const user = userEvent.setup();
    const store = setInitialState({});
    store.set(elevationSourcesAtom, [aMapboxSource]);

    vi.mocked(extractGeoTiffMetadata)
      .mockResolvedValueOnce({
        file: new File([""], "tile1.tif"),
        width: 100,
        height: 100,
        bbox: [-4.0, 55.0, -3.0, 56.0],
        pixelToGps: [0, 1, 0, 0, 0, 1],
        gpsToPixel: [0, 1, 0, 0, 0, 1],
        noDataValue: null,
        image: mockImage,
      })
      .mockResolvedValueOnce({
        file: new File([""], "tile2.tif"),
        width: 100,
        height: 100,
        bbox: [-3.0, 55.0, -2.0, 56.0],
        pixelToGps: [0, 1, 0, 0, 0, 1],
        gpsToPixel: [0, 1, 0, 0, 0, 1],
        noDataValue: null,
        image: mockImage,
      });

    renderComponent(store);

    const file1 = new File([""], "tile1.tif", { type: "image/tiff" });
    const file2 = new File([""], "tile2.tif", { type: "image/tiff" });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(input, [file1, file2]);

    await waitFor(() => {
      const sources = store.get(elevationSourcesAtom);
      const geotiffSource = sources.find(
        (s) => s.type === "geotiff",
      ) as GeoTiffElevationSource;
      expect(geotiffSource.tiles).toHaveLength(2);
    });

    const geotiffSource = store
      .get(elevationSourcesAtom)
      .find((s) => s.type === "geotiff") as GeoTiffElevationSource;
    expect(geotiffSource.tiles[0].file.name).toBe("tile1.tif");
    expect(geotiffSource.tiles[1].file.name).toBe("tile2.tif");
  });

  it("deletes an individual tile from the popover", async () => {
    const user = userEvent.setup();
    const store = setInitialState({});
    store.set(elevationSourcesAtom, [aMapboxSource, aGeoTiffSource]);
    renderComponent(store);

    const configButtons = screen.getAllByRole("button");
    const geotiffConfigButton = configButtons.find((btn) =>
      btn.closest("[class*='py-2']")?.textContent?.includes("GEOTIFF"),
    );
    await user.click(geotiffConfigButton!);

    const tile1DeleteButton = screen
      .getByText("o41078a1.tif")
      .closest("div")!
      .querySelector(".text-red-500")!;
    await user.click(tile1DeleteButton);

    const sources = store.get(elevationSourcesAtom);
    const geotiffSource = sources.find(
      (s) => s.type === "geotiff",
    ) as GeoTiffElevationSource;
    expect(geotiffSource.tiles).toHaveLength(1);
    expect(geotiffSource.tiles[0].file.name).toBe("o41078a2.tif");
  });

  it("removes the source when the last tile is deleted", async () => {
    const singleTileSource: GeoTiffElevationSource = {
      ...aGeoTiffSource,
      tiles: [aGeoTiffSource.tiles[0]],
    };
    const user = userEvent.setup();
    const store = setInitialState({});
    store.set(elevationSourcesAtom, [aMapboxSource, singleTileSource]);
    renderComponent(store);

    const configButtons = screen.getAllByRole("button");
    const geotiffConfigButton = configButtons.find((btn) =>
      btn.closest("[class*='py-2']")?.textContent?.includes("GEOTIFF"),
    );
    await user.click(geotiffConfigButton!);

    const tileDeleteButton = screen
      .getByText("o41078a1.tif")
      .closest("div")!
      .querySelector(".text-red-500")!;
    await user.click(tileDeleteButton);

    const sources = store.get(elevationSourcesAtom);
    expect(sources).toHaveLength(1);
    expect(sources[0].type).toBe("tile-server");
  });

  it("prepends new tiles when adding more to an existing source", async () => {
    const user = userEvent.setup();
    const store = setInitialState({});
    store.set(elevationSourcesAtom, [aMapboxSource, aGeoTiffSource]);

    vi.mocked(extractGeoTiffMetadata).mockResolvedValue({
      file: new File([""], "new-tile.tif"),
      width: 100,
      height: 100,
      bbox: [-2.0, 55.0, -1.0, 56.0],
      pixelToGps: [0, 1, 0, 0, 0, 1],
      gpsToPixel: [0, 1, 0, 0, 0, 1],
      noDataValue: null,
      image: mockImage,
    });

    renderComponent(store);

    // Open the popover
    const configButtons = screen.getAllByRole("button");
    const geotiffConfigButton = configButtons.find((btn) =>
      btn.closest("[class*='py-2']")?.textContent?.includes("GEOTIFF"),
    );
    await user.click(geotiffConfigButton!);

    // Use the "Add more tiles" file input inside the popover
    const popoverInputs = document.querySelectorAll('input[type="file"]');
    const addMoreInput = popoverInputs[
      popoverInputs.length - 1
    ] as HTMLInputElement;
    const file = new File([""], "new-tile.tif", { type: "image/tiff" });
    await user.upload(addMoreInput, file);

    await waitFor(() => {
      const sources = store.get(elevationSourcesAtom);
      const geotiffSource = sources.find(
        (s) => s.type === "geotiff",
      ) as GeoTiffElevationSource;
      expect(geotiffSource.tiles).toHaveLength(3);
    });

    const geotiffSource = store
      .get(elevationSourcesAtom)
      .find((s) => s.type === "geotiff") as GeoTiffElevationSource;
    // New tile should be first (prepended)
    expect(geotiffSource.tiles[0].file.name).toBe("new-tile.tif");
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
