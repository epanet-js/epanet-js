"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "src/styles/globals.css";
import * as T from "@radix-ui/react-tooltip";

import { Suspense, useState } from "react";
import { PersistenceProvider } from "src/lib/persistence";
import { Provider, createStore } from "jotai";
import { Store } from "src/state";
import { AuthProvider } from "src/providers/auth-provider";
import dynamic from "next/dynamic";

import { ErrorBoundary } from "@sentry/nextjs";
import { FallbackError } from "src/components/fallback-error";
import { FeatureFlagsProvider } from "src/hooks/use-feature-flags";
import { LocaleProvider } from "src/hooks/use-locale";
import { AppUIConfigProvider } from "src/components/app-ui-config-provider";

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
  return (
    <AuthProvider>
      <UserTrackingProvider>
        <FeatureFlagsProvider>
          <LocaleProvider>
            <AppUIConfigProvider>
              <PersistenceProvider store={store}>
                <Suspense fallback={null}>
                  <EpanetApp />
                </Suspense>
              </PersistenceProvider>
            </AppUIConfigProvider>
          </LocaleProvider>
        </FeatureFlagsProvider>
      </UserTrackingProvider>
    </AuthProvider>
  );
}

const Play = () => {
  const [store] = useState(createStore);

  return (
    <Provider key="play" store={store}>
      <ScratchpadInner store={store} />
    </Provider>
  );
};
