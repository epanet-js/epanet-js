import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { setInitialState } from "src/__helpers__/state";
import { basemaps } from "src/map/basemaps";
import { ILayerConfig } from "src/types";
import { USelection } from "src/selection";
import { selectionAtom } from "src/state/selection";
import { Store } from "src/state";
import { renderMap } from "./__helpers__/map";

const auth = vi.hoisted(() => {
  let isSignedIn = false;
  const listeners = new Set<() => void>();
  return {
    isSignedIn: () => isSignedIn,
    setSignedIn: (value: boolean) => {
      isSignedIn = value;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

vi.mock("src/hooks/use-auth", async () => {
  const { useSyncExternalStore } = await import("react");
  const { nullUser } = await import("src/auth-types");
  return {
    useAuth: () => ({
      isLoaded: true,
      isSignedIn: useSyncExternalStore(auth.subscribe, auth.isSignedIn),
      userId: undefined,
      user: nullUser,
      signOut: async () => {},
      reload: async () => {},
      getToken: () => Promise.resolve(null),
    }),
  };
});

const SATELLITE_STYLE = {
  version: 8,
  sources: {
    "mapbox-satellite": {
      type: "raster",
      url: "mapbox://mapbox.satellite",
      tileSize: 256,
    },
  },
  layers: [
    { id: "satellite", type: "raster", source: "mapbox-satellite" },
    { id: "road-label", type: "symbol", source: "composite" },
  ],
};

describe("satellite resolution cap", () => {
  it("caps the satellite source in the initial style when signed out", async () => {
    const map = await renderSatelliteMap({ isSignedIn: false });

    expect(map.setStyle.mock.lastCall?.[0]).toMatchObject({
      sources: { "mapbox-satellite": { maxzoom: 16 } },
    });
  });

  it("does not cap the satellite source in the initial style when signed in", async () => {
    const map = await renderSatelliteMap({ isSignedIn: true });

    expect(
      map.setStyle.mock.lastCall?.[0].sources["mapbox-satellite"],
    ).not.toHaveProperty("maxzoom");
  });

  it("lifts the cap without rebuilding the style when signing in", async () => {
    const map = await renderSatelliteMap({ isSignedIn: false });

    act(() => auth.setSignedIn(true));

    await waitFor(() => {
      expect(map.map.addSource).toHaveBeenCalled();
    });
    const [, source] = vi.mocked(map.map.addSource).mock.lastCall!;
    expect(source).not.toHaveProperty("maxzoom");
    expect(map.map.removeLayer).toHaveBeenCalledWith("satellite");
    expect(map.map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: "satellite" }),
      undefined,
    );
    expect(map.setStyle).toHaveBeenCalledTimes(1);
  });

  it("applies the cap without rebuilding the style when signing out", async () => {
    const map = await renderSatelliteMap({ isSignedIn: true });

    act(() => auth.setSignedIn(false));

    await waitFor(() => {
      expect(map.map.addSource).toHaveBeenCalledWith(
        "mapbox-satellite",
        expect.objectContaining({ maxzoom: 16 }),
      );
    });
    expect(map.map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "satellite",
        paint: expect.objectContaining({ "raster-resampling": "nearest" }),
      }),
      undefined,
    );
    expect(map.setStyle).toHaveBeenCalledTimes(1);
  });
});

const rerenderCanvasWithMap = (store: Store) =>
  act(() => store.set(selectionAtom, USelection.singleAsset(1)));

const renderSatelliteMap = async ({ isSignedIn }: { isSignedIn: boolean }) => {
  vi.stubGlobal("fetch", () =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(SATELLITE_STYLE) }),
  );
  auth.setSignedIn(isSignedIn);

  const satellite: ILayerConfig = {
    ...basemaps.satellite,
    id: "basemap",
    at: "a0",
    tms: false,
    visibility: true,
    labelVisibility: true,
  };
  const store = setInitialState({
    layerConfigs: new Map([["basemap", satellite]]),
  });

  const map = await renderMap(store);
  rerenderCanvasWithMap(store);
  await waitFor(() => {
    expect(map.setStyle).toHaveBeenCalledTimes(1);
  });

  return map;
};
