import { useState, useCallback, useRef } from "react";
// eslint-disable-next-line no-restricted-imports
import proj4 from "proj4";
import { extractRawCoordinates } from "src/lib/geojson-utils/reproject-inp";
import type { Projection } from "src/hooks/use-projections";

export type RawCoordinate = { name: string; x: number; y: number };

export type PreviewPoint = { name: string; lng: number; lat: number };

export type ConverterState = {
  file: File | null;
  rawInpText: string | null;
  rawCoordinates: RawCoordinate[];
  selectedProjection: Projection | null;
  previewPoints: PreviewPoint[];
  isLoading: boolean;
  error: string | null;
};

export function useConverter(initialFile?: File) {
  const [state, setState] = useState<ConverterState>({
    file: initialFile ?? null,
    rawInpText: null,
    rawCoordinates: [],
    selectedProjection: null,
    previewPoints: [],
    isLoading: false,
    error: null,
  });

  const initialFileReadRef = useRef(false);

  // Auto-read the initial file on first mount
  const readInitialFile = useCallback(async () => {
    if (!initialFile || initialFileReadRef.current) return;
    initialFileReadRef.current = true;
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const text = await initialFile.text();
      const rawCoordinates = extractRawCoordinates(text);
      setState((prev) => ({
        ...prev,
        file: initialFile,
        rawInpText: text,
        rawCoordinates,
        isLoading: false,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "Failed to read file",
      }));
    }
  }, [initialFile]);

  const selectProjection = useCallback(
    (projection: Projection) => {
      setState((prev) => ({ ...prev, selectedProjection: projection }));

      if (!state.rawCoordinates.length) return;

      try {
        const converter = proj4(projection.code, "EPSG:4326");
        const previewPoints: PreviewPoint[] = state.rawCoordinates
          .map(({ name, x, y }) => {
            try {
              const [lng, lat] = converter.forward([x, y]);
              if (
                isFinite(lng) &&
                isFinite(lat) &&
                lat >= -90 &&
                lat <= 90 &&
                lng >= -180 &&
                lng <= 180
              ) {
                return { name, lng, lat };
              }
              return null;
            } catch {
              return null;
            }
          })
          .filter((p): p is PreviewPoint => p !== null);

        setState((prev) => ({
          ...prev,
          previewPoints,
          selectedProjection: projection,
        }));
      } catch {
        setState((prev) => ({
          ...prev,
          previewPoints: [],
          selectedProjection: projection,
        }));
      }
    },
    [state.rawCoordinates],
  );

  const clearProjection = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedProjection: null,
      previewPoints: [],
    }));
  }, []);

  return {
    state,
    readInitialFile,
    selectProjection,
    clearProjection,
  };
}
