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
import { useJunctionSize } from "./use-junction-size";

const JUNCTION_LAYERS = [
  "main-features-junctions",
  "delta-features-junctions",
  "ephemeral-junction-highlight",
  "highlights-marker",
  "selected-junctions",
];

const createFakeMap = (opts?: {
  styleLoaded?: boolean;
  existingLayers?: string[];
}) => {
  const styleLoaded = opts?.styleLoaded ?? true;
  const existing = opts?.existingLayers ?? JUNCTION_LAYERS;
  const setLayerPaintRule = vi.fn();
  const map = {
    isStyleLoaded: vi.fn().mockReturnValue(styleLoaded),
    getLayer: vi.fn((id: string) =>
      existing.includes(id) ? ({ id } as unknown) : undefined,
    ),
  };
  const engine = { map, setLayerPaintRule } as unknown as MapEngine;
  return { engine, setLayerPaintRule };
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
        26,
        12,
      ]);
    }
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
      ["interpolate", ["linear"], ["zoom"], 11, 3, 26, 9],
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
    const { engine, setLayerPaintRule } = createFakeMap({ styleLoaded: false });
    const { result } = renderUseJunctionSize(engine);

    act(() =>
      result.current.onChange({ minVisibleZoom: 10, minSize: 2, maxSize: 12 }),
    );
    act(() => {
      vi.advanceTimersByTime(80);
    });

    expect(setLayerPaintRule).not.toHaveBeenCalled();
  });
});
