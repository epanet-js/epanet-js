import { useAuth } from "src/auth";
import { useLocale } from "src/hooks/use-locale";
import { useFeatureFlagsReady } from "src/hooks/use-feature-flags";
import { useState, useEffect, useRef } from "react";

const MAX_LOADING_TIME = 10000;

const hasLoadFlag = (): boolean => {
  if (typeof window === "undefined") return false;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("FLAG_LOAD") === "true";
};

type LoadingStep = {
  id: string;
  isComplete: boolean;
};

type AppReadyState = {
  isReady: boolean;
  progress: number;
  steps: LoadingStep[];
  hasTimedOut: boolean;
};

export const useAppReady = (): AppReadyState => {
  const { isLoaded: authLoaded } = useAuth();
  const { isI18nReady } = useLocale();
  const featureFlagsReady = useFeatureFlagsReady();
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [showOptimisticProgress, setShowOptimisticProgress] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      setHasTimedOut(true);
    }, MAX_LOADING_TIME);

    setTimeout(() => {
      setShowOptimisticProgress(true);
    }, 100);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const steps: LoadingStep[] = [
    {
      id: "auth",
      isComplete: authLoaded || hasTimedOut,
    },
    {
      id: "featureFlags",
      isComplete: featureFlagsReady || hasTimedOut,
    },
    {
      id: "i18n",
      isComplete: isI18nReady || hasTimedOut,
    },
  ];

  const systemsReady = steps.every((step) => step.isComplete);

  useEffect(() => {
    if (systemsReady || hasTimedOut) {
      setTimeout(() => {
        setShowComplete(true);
      }, 500);
    }
  }, [systemsReady, hasTimedOut]);

  const isReady = hasLoadFlag() ? showComplete : true;

  const progress =
    systemsReady || hasTimedOut ? 100 : showOptimisticProgress ? 85 : 0;

  useEffect(() => {
    if (systemsReady && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, [systemsReady]);

  return {
    isReady,
    progress,
    steps,
    hasTimedOut,
  };
};
