import { MapTestEngine } from "./map-engine-mock";
import { Store } from "src/state/jotai";
import { UIDMap } from "src/lib/id-mapper";
import { MemPersistence } from "src/lib/persistence/memory";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai";
import { PersistenceContext } from "src/lib/persistence/context";
import { MapCanvas } from "src/map/map-canvas";

export const renderMap = async (store: Store): Promise<MapTestEngine> => {
  let mapEngine: MapTestEngine | null = null;
  const idMap = UIDMap.empty();
  const persistence = new MemPersistence(idMap, store);
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

  return mapEngine;
};
