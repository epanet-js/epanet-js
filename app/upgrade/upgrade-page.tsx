"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as T from "@radix-ui/react-tooltip";
import { Suspense, useEffect, useRef } from "react";
import { AuthProvider } from "src/auth";
import dynamic from "next/dynamic";
import { ErrorBoundary } from "@sentry/nextjs";
import { FallbackError } from "src/components/fallback-error";
import { FeatureFlagsProvider } from "src/hooks/use-feature-flags";
import { Loading } from "src/components/elements";
import { EMBEDDED_MIN_HEIGHT } from "src/embedded";

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
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;

    const observer = new ResizeObserver(() => {
      const height = contentRef.current?.scrollHeight;
      if (height && window.parent) {
        window.parent.postMessage(
          { type: "iframeHeight", height: height },
          "*",
        );
      }
    });

    observer.observe(contentRef.current);

    const height = contentRef.current?.scrollHeight;
    if (height && window.parent) {
      window.parent.postMessage({ type: "iframeHeight", height: height }, "*");
    }

    return () => observer.disconnect();
  }, [contentRef.current]);

  return (
    <div
      ref={contentRef}
      className="w-full mx-auto py-1"
      style={{
        overflowY: "hidden",
        minHeight: `${EMBEDDED_MIN_HEIGHT}px`,
      }}
    >
      <ErrorBoundary fallback={FallbackError}>
        <QueryClientProvider client={queryClient}>
          <T.Provider>
            <AuthProvider>
              <UserTrackingProvider>
                <FeatureFlagsProvider>
                  <Suspense fallback={<Loading />}>
                    <StandaloneUpgradeContent />
                  </Suspense>
                </FeatureFlagsProvider>
              </UserTrackingProvider>
            </AuthProvider>
          </T.Provider>
        </QueryClientProvider>
      </ErrorBoundary>
    </div>
  );
}
