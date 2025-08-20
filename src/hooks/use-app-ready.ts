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
  weight: number;
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
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      setHasTimedOut(true);
    }, MAX_LOADING_TIME);

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
      weight: 0.2,
    },
    {
      id: "featureFlags",
      isComplete: featureFlagsReady || hasTimedOut,
      weight: 0.3,
    },
    {
      id: "i18n",
      isComplete: isI18nReady || hasTimedOut,
      weight: 0.5,
    },
  ];

  const progress = steps.reduce((total, step) => {
    return total + (step.isComplete ? step.weight * 100 : 0);
  }, 0);

  const systemsReady = steps.every((step) => step.isComplete);
  const isReady = hasLoadFlag() ? systemsReady : true;

  useEffect(() => {
    if (systemsReady && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, [systemsReady]);

  return {
    isReady,
    progress: Math.round(progress),
    steps,
    hasTimedOut,
  };
};
