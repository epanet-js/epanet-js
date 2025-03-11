"use client";

import { QueryClient, QueryClientProvider } from "react-query";
//import Play from "src/pages/index-deprecated";
import "src/styles/globals.css";
import * as T from "@radix-ui/react-tooltip";

const queryClient = new QueryClient();
export default function HomePage({}) {
  return (
    <QueryClientProvider client={queryClient}>
      <T.Provider>
        <Play />
      </T.Provider>
    </QueryClientProvider>
  );
}
import { Suspense, useRef } from "react";
import { PersistenceContext } from "src/lib/persistence/context";
import { MemPersistence } from "src/lib/persistence/memory";
import { Provider, createStore } from "jotai";
import { UIDMap } from "src/lib/id_mapper";
import { Store, layerConfigAtom } from "src/state/jotai";
import { newFeatureId } from "src/lib/id";
import LAYERS from "src/lib/default_layers";
import { AuthProvider } from "src/auth";
import dynamic from "next/dynamic";

const PlacemarkPlay = dynamic(
  () => import("src/components/placemark_play").then((m) => m.PlacemarkPlay),
  {
    ssr: false,
  },
);

const UserTrackingProvider = dynamic(
  () => import("src/infra/user-tracking").then((m) => m.UserTrackingProvider),
  {
    ssr: false,
  },
);

function ScratchpadInner({ store }: { store: Store }) {
  const idMap = useRef(UIDMap.empty());

  return (
    <UserTrackingProvider>
      <PersistenceContext.Provider
        value={new MemPersistence(idMap.current, store)}
      >
        <Suspense fallback={null}>
          <AuthProvider>
            <PlacemarkPlay />
          </AuthProvider>
        </Suspense>
      </PersistenceContext.Provider>
    </UserTrackingProvider>
  );
}

const Play = () => {
  const store = createStore();
  const layerId = newFeatureId();

  store.set(
    layerConfigAtom,
    new Map([
      [
        layerId,
        {
          ...LAYERS.MONOCHROME,
          at: "a0",
          opacity: 1,
          tms: false,
          labelVisibility: true,
          visibility: true,
          id: layerId,
        },
      ],
    ]),
  );

  return (
    <Provider key="play" store={store}>
      <ScratchpadInner store={store} />
    </Provider>
  );
};
