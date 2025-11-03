import { MapTestEngine, stubNoSnapping } from "./map-engine-mock";
import { Store } from "src/state/jotai";
import { MemPersistence } from "src/lib/persistence/memory";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai";
import { PersistenceContext } from "src/lib/persistence/context";
import { MapCanvas } from "src/map/map-canvas";

export const renderMap = async (store: Store): Promise<MapTestEngine> => {
  let mapEngine: MapTestEngine | null = null;
  const persistence = new MemPersistence(store);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <JotaiProvider store={store}>
        <PersistenceContext.Provider value={persistence}>
          <MapCanvas
            setMap={(mapEngineInstance) => {
              mapEngine = mapEngineInstance as unknown as MapTestEngine;
            }}
          />
        </PersistenceContext.Provider>
      </JotaiProvider>
    </QueryClientProvider>,
  );

  await waitFor(() => {
    expect(mapEngine).toBeTruthy();
  });

  if (!mapEngine) throw new Error("MapTestEngine instance not set");

  stubNoSnapping(mapEngine);

  return mapEngine;
};

export const matchPoint = (
  geometry: Partial<{ coordinates: number[]; [key: string]: unknown }>,
): ReturnType<typeof expect.objectContaining> =>
  expect.objectContaining({
    geometry: expect.objectContaining({
      type: "Point",
      ...geometry,
    }),
  });

export const matchLineString = (
  geometry: Partial<{ coordinates: number[][]; [key: string]: unknown }>,
): ReturnType<typeof expect.objectContaining> =>
  expect.objectContaining({
    geometry: expect.objectContaining({
      type: "LineString",
      ...geometry,
    }),
  });
