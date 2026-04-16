"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as T from "@radix-ui/react-tooltip";
import { Provider, createStore } from "jotai";
import dynamic from "next/dynamic";
import { AuthProvider } from "src/providers/auth-provider";
import { FeatureFlagsProvider } from "src/hooks/use-feature-flags";
import { LocaleProvider } from "src/hooks/use-locale";
import { PersistenceProvider } from "src/lib/persistence";

// Stable module-level instances — not recreated on re-renders
const queryClient = new QueryClient();
const store = createStore();

const UserTrackingProvider = dynamic(
  () => import("src/infra/user-tracking").then((m) => m.UserTrackingProvider),
  { ssr: false, loading: () => null },
);

export const LayoutTestProviders = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <QueryClientProvider client={queryClient}>
    <T.Provider>
      <Provider store={store}>
        <AuthProvider>
          <UserTrackingProvider>
            <FeatureFlagsProvider>
              <LocaleProvider>
                <PersistenceProvider store={store}>
                  {children}
                </PersistenceProvider>
              </LocaleProvider>
            </FeatureFlagsProvider>
          </UserTrackingProvider>
        </AuthProvider>
      </Provider>
    </T.Provider>
  </QueryClientProvider>
);
