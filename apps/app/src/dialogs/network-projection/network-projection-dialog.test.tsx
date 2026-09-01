import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeatureCollection } from "geojson";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import { stubProjectionsReady } from "src/__helpers__/projections";
import { geocodingQueryClient } from "src/lib/geocoding";
import { NetworkProjectionDialog } from "./network-projection-dialog";
import type { Bbox } from "./types";
import type { MapPreviewHandle } from "./use-map-preview";

const mapPreview = vi.hoisted(() => ({
  viewportBbox: null as Bbox | null,
  onBoundsChange: null as ((bbox: Bbox) => void) | null,
}));

vi.mock("./map-preview", async () => {
  const { useEffect } = await import("react");
  return {
    MapPreview: ({
      setHandle,
      onBoundsChange,
    }: {
      setHandle: (handle: MapPreviewHandle | null) => void;
      onBoundsChange?: (bbox: Bbox) => void;
    }) => {
      useEffect(() => {
        setHandle({
          fitToNetwork: () => {},
          fitToBbox: () => mapPreview.viewportBbox,
        });
        return () => setHandle(null);
      }, [setHandle]);
      useEffect(() => {
        mapPreview.onBoundsChange = onBoundsChange ?? null;
      }, [onBoundsChange]);
      return <div />;
    },
  };
});

const NETWORK_BBOX: Bbox = [0.2, 40.0, 0.21, 40.01];
const LOCATION_BBOX: Bbox = [0.0, 39.95, 0.1, 40.05];
const FITTED_VIEWPORT_BBOX: Bbox = [-0.1, 39.9, 0.3, 40.1];

const previewGeoJson: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [NETWORK_BBOX[0], NETWORK_BBOX[1]],
          [NETWORK_BBOX[2], NETWORK_BBOX[3]],
        ],
      },
    },
  ],
};

const locationResponse = {
  ok: true,
  status: 200,
  json: () =>
    Promise.resolve({
      features: [
        {
          place_name: "Riverside",
          center: [0.05, 40.0],
          bbox: LOCATION_BBOX,
        },
      ],
    }),
} as unknown as Response;

const selectRiverside = async () => {
  render(
    <NetworkProjectionDialog
      source="import"
      previewGeoJson={previewGeoJson}
      onImportWithProjection={vi.fn()}
      filename="my-network.inp"
      flowUnits="LPS"
    />,
  );

  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox"), "riverside");
  await user.click(await screen.findByRole("option", { name: "Riverside" }));
};

describe("NetworkProjectionDialog", () => {
  beforeEach(() => {
    geocodingQueryClient.clear();
    stubProjectionsReady();
    mapPreview.viewportBbox = FITTED_VIEWPORT_BBOX;
    mapPreview.onBoundsChange = null;
    global.fetch = vi.fn().mockResolvedValue(locationResponse);
  });

  it("misses a projection just outside the location bbox until the user zooms out", async () => {
    stubFeatureOff("FLAG_BBOX_MAP");

    await selectRiverside();

    expect(
      await screen.findByText("No matching projections found here"),
    ).toBeInTheDocument();

    act(() => {
      mapPreview.onBoundsChange?.(FITTED_VIEWPORT_BBOX);
    });

    expect(await screen.findByText("EPSG:4326")).toBeInTheDocument();
  });

  it("finds it on selection when the map viewport is the search area", async () => {
    stubFeatureOn("FLAG_BBOX_MAP");

    await selectRiverside();

    expect(await screen.findByText("EPSG:4326")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByText("No matching projections found here"),
      ).toBeNull();
    });
  });
});
