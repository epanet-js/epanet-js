"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "src/styles/globals.css";
import * as T from "@radix-ui/react-tooltip";

import { Suspense, useRef } from "react";
import { PersistenceContext } from "src/lib/persistence/context";
import { MemPersistence } from "src/lib/persistence/memory";
import { Provider, createStore } from "jotai";
import { UIDMap } from "src/lib/id-mapper";
import { Store, layerConfigAtom } from "src/state/jotai";
import { newFeatureId } from "src/lib/id";
import { basemaps } from "src/map/basemaps";
import { AuthProvider } from "src/auth";
import dynamic from "next/dynamic";

import { ErrorBoundary } from "@sentry/nextjs";
import { FallbackError } from "src/components/fallback-error";
import { FeatureFlagsProvider } from "src/hooks/use-feature-flags";
import { ErrorTrackingProvider } from "src/hooks/use-error-tracking";
import { LocaleProvider } from "src/hooks/use-locale";

const queryClient = new QueryClient();
export default function HomePage({}) {
  return (
    <ErrorBoundary fallback={FallbackError}>
      <QueryClientProvider client={queryClient}>
        <T.Provider>
          <Play />
        </T.Provider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
const EpanetApp = dynamic(
  () => import("src/components/epanet-app").then((m) => m.EpanetApp),
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
    <ErrorTrackingProvider>
      <AuthProvider>
        <UserTrackingProvider>
          <FeatureFlagsProvider>
            <LocaleProvider>
              <PersistenceContext.Provider
                value={new MemPersistence(idMap.current, store)}
              >
                <Suspense fallback={null}>
                  <EpanetApp />
                </Suspense>
              </PersistenceContext.Provider>
            </LocaleProvider>
          </FeatureFlagsProvider>
        </UserTrackingProvider>
      </AuthProvider>
    </ErrorTrackingProvider>
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
          ...basemaps.monochrome,
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
