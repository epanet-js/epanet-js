"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as T from "@radix-ui/react-tooltip";
import { Suspense } from "react";
import { AuthProvider } from "src/auth";
import dynamic from "next/dynamic";
import { ErrorBoundary } from "@sentry/nextjs";
import { FallbackError } from "src/components/fallback-error";
import { FeatureFlagsProvider } from "src/hooks/use-feature-flags";
import { Loading } from "src/components/elements";

const UserTrackingProvider = dynamic(
  () => import("src/infra/user-tracking").then((m) => m.UserTrackingProvider),
  {
    ssr: false,
  },
);

const StandaloneUpgradeContent = dynamic(
  () => import("./upgrade-content").then((m) => m.StandaloneUpgradeContent),
  {
    ssr: false,
    loading: () => <Loading />,
  },
);

const queryClient = new QueryClient();

export default function UpgradePage() {
  return (
    <ErrorBoundary fallback={FallbackError}>
      <QueryClientProvider client={queryClient}>
        <T.Provider>
          <AuthProvider>
            <UserTrackingProvider>
              <FeatureFlagsProvider>
                <div className="mx-auto p-6">
                  <Suspense fallback={<Loading />}>
                    <StandaloneUpgradeContent />
                  </Suspense>
                </div>
              </FeatureFlagsProvider>
            </UserTrackingProvider>
          </AuthProvider>
        </T.Provider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
