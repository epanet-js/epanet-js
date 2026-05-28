import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { renderHook, act } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { MapContext } from "src/map";
import type { MapEngine } from "src/map/map-engine";
import {
  defaultNodeSizeConfig,
  type NodeSizeConfig,
} from "src/map/symbology/symbology-types";
import {
  junctionCircleRadius,
  junctionLayerMinZoom,
  LAYER_MAX_ZOOM,
  useJunctionSize,
} from "./node-size-field";

describe("junctionCircleRadius", () => {
  it("interpolates minSize at minVisibleZoom up to maxSize at LAYER_MAX_ZOOM", () => {
    expect(junctionCircleRadius(defaultNodeSizeConfig)).toEqual([
      "interpolate",
      ["linear"],
      ["zoom"],
      defaultNodeSizeConfig.minVisibleZoom,
      defaultNodeSizeConfig.minSize,
      LAYER_MAX_ZOOM,
      defaultNodeSizeConfig.maxSize,
    ]);
  });

  it("uses the configured min zoom and sizes as the interpolation stops", () => {
    expect(
      junctionCircleRadius({
        minVisibleZoom: 14,
        minSize: 2,
        maxSize: 12,
      }),
    ).toEqual(["interpolate", ["linear"], ["zoom"], 14, 2, LAYER_MAX_ZOOM, 12]);
  });

  it("returns a flat radius (no interpolation) when min and max size are equal", () => {
    expect(
      junctionCircleRadius({ minVisibleZoom: 12, minSize: 4, maxSize: 4 }),
    ).toBe(4);
  });

  it("returns a flat maxSize when minVisibleZoom is at the upper stop", () => {
    expect(
      junctionCircleRadius({
        minVisibleZoom: LAYER_MAX_ZOOM,
        minSize: 2,
        maxSize: 12,
      }),
    ).toBe(12);
  });
});

describe("junctionLayerMinZoom", () => {
  it("uses the configured min visible zoom", () => {
    expect(
      junctionLayerMinZoom({ minVisibleZoom: 12, minSize: 1, maxSize: 5 }),
    ).toBe(12);
  });

  it("clamps to the style-spec layer max (24) above it", () => {
    expect(
      junctionLayerMinZoom({ minVisibleZoom: 26, minSize: 1, maxSize: 5 }),
    ).toBe(LAYER_MAX_ZOOM);
  });
});

const JUNCTION_LAYERS = [
  "main-features-junctions",
  "delta-features-junctions",
  "ephemeral-junction-highlight",
  "highlights-marker",
  "selected-junctions",
];

// minzoom only tracks the "real" junction display + selection.
const VISIBILITY_LAYERS = [
  "main-features-junctions",
  "delta-features-junctions",
  "selected-junctions",
];

const createFakeMap = (opts?: {
  styleLoaded?: boolean;
  existingLayers?: string[];
}) => {
  const styleLoaded = opts?.styleLoaded ?? true;
  const existing = opts?.existingLayers ?? JUNCTION_LAYERS;
  const setLayerPaintRule = vi.fn();
  const setLayerZoomRange = vi.fn();
  const map = {
    isStyleLoaded: vi.fn().mockReturnValue(styleLoaded),
    getLayer: vi.fn((id: string) =>
      existing.includes(id) ? ({ id } as unknown) : undefined,
    ),
  };
  const engine = {
    map,
    setLayerPaintRule,
    setLayerZoomRange,
  } as unknown as MapEngine;
  return { engine, setLayerPaintRule, setLayerZoomRange };
};

const renderUseJunctionSize = (engine: MapEngine) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={createStore()}>
      <MapContext.Provider value={engine}>{children}</MapContext.Provider>
    </Provider>
  );
  return renderHook(() => useJunctionSize(), { wrapper });
};

describe("useJunctionSize", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts from the default config", () => {
    const { engine } = createFakeMap();
    const { result } = renderUseJunctionSize(engine);

    expect(result.current.config).toEqual(defaultNodeSizeConfig);
  });

  it("updates the config synchronously on change", () => {
    const { engine } = createFakeMap();
    const { result } = renderUseJunctionSize(engine);
    const next: NodeSizeConfig = {
      minVisibleZoom: 10,
      minSize: 2,
      maxSize: 12,
    };

    act(() => result.current.onChange(next));

    expect(result.current.config).toEqual(next);
  });

  it("applies the debounced circle-radius to every junction layer", () => {
    const { engine, setLayerPaintRule } = createFakeMap();
    const { result } = renderUseJunctionSize(engine);
    const next: NodeSizeConfig = {
      minVisibleZoom: 10,
      minSize: 2,
      maxSize: 12,
    };

    act(() => result.current.onChange(next));
    expect(setLayerPaintRule).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(80);
    });

    expect(setLayerPaintRule).toHaveBeenCalledTimes(JUNCTION_LAYERS.length);
    for (const layerId of JUNCTION_LAYERS) {
      expect(setLayerPaintRule).toHaveBeenCalledWith(layerId, "circle-radius", [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        2,
        24,
        12,
      ]);
    }
  });

  it("applies min visible zoom as minzoom to the feature/selection layers only", () => {
    const { engine, setLayerZoomRange } = createFakeMap();
    const { result } = renderUseJunctionSize(engine);

    act(() =>
      result.current.onChange({ minVisibleZoom: 9, minSize: 2, maxSize: 12 }),
    );
    act(() => {
      vi.advanceTimersByTime(80);
    });

    expect(setLayerZoomRange).toHaveBeenCalledTimes(VISIBILITY_LAYERS.length);
    for (const layerId of VISIBILITY_LAYERS) {
      // minzoom = min visible zoom; maxzoom = one above the map max so junctions
      // stay visible at the top zoom.
      expect(setLayerZoomRange).toHaveBeenCalledWith(layerId, 9, 27);
    }
    // The draft + hover-highlight layers keep their own lower minzoom.
    expect(setLayerZoomRange).not.toHaveBeenCalledWith(
      "ephemeral-junction-highlight",
      expect.anything(),
      expect.anything(),
    );
    expect(setLayerZoomRange).not.toHaveBeenCalledWith(
      "highlights-marker",
      expect.anything(),
      expect.anything(),
    );
  });

  it("clamps minzoom to the max selectable zoom (24) when min visible zoom exceeds it", () => {
    const { engine, setLayerZoomRange } = createFakeMap();
    const { result } = renderUseJunctionSize(engine);

    act(() =>
      result.current.onChange({ minVisibleZoom: 26, minSize: 2, maxSize: 12 }),
    );
    act(() => {
      vi.advanceTimersByTime(80);
    });

    expect(setLayerZoomRange).toHaveBeenCalledWith(
      "main-features-junctions",
      24,
      27,
    );
  });

  it("coalesces rapid changes into a single paint per layer", () => {
    const { engine, setLayerPaintRule } = createFakeMap();
    const { result } = renderUseJunctionSize(engine);

    act(() => {
      result.current.onChange({ minVisibleZoom: 10, minSize: 1, maxSize: 6 });
      result.current.onChange({ minVisibleZoom: 11, minSize: 3, maxSize: 9 });
    });
    act(() => {
      vi.advanceTimersByTime(80);
    });

    expect(setLayerPaintRule).toHaveBeenCalledTimes(JUNCTION_LAYERS.length);
    expect(setLayerPaintRule).toHaveBeenCalledWith(
      "main-features-junctions",
      "circle-radius",
      ["interpolate", ["linear"], ["zoom"], 11, 3, 24, 9],
    );
  });

  it("skips layers that are not present in the style", () => {
    const { engine, setLayerPaintRule } = createFakeMap({
      existingLayers: ["main-features-junctions"],
    });
    const { result } = renderUseJunctionSize(engine);

    act(() =>
      result.current.onChange({ minVisibleZoom: 10, minSize: 2, maxSize: 12 }),
    );
    act(() => {
      vi.advanceTimersByTime(80);
    });

    expect(setLayerPaintRule).toHaveBeenCalledTimes(1);
    expect(setLayerPaintRule).toHaveBeenCalledWith(
      "main-features-junctions",
      "circle-radius",
      expect.anything(),
    );
  });

  it("does not touch the map until the style is loaded", () => {
    const { engine, setLayerPaintRule, setLayerZoomRange } = createFakeMap({
      styleLoaded: false,
    });
    const { result } = renderUseJunctionSize(engine);

    act(() =>
      result.current.onChange({ minVisibleZoom: 10, minSize: 2, maxSize: 12 }),
    );
    act(() => {
      vi.advanceTimersByTime(80);
    });

    expect(setLayerPaintRule).not.toHaveBeenCalled();
    expect(setLayerZoomRange).not.toHaveBeenCalled();
  });
});
