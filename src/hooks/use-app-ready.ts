import { useAuth } from "src/auth";
import { useLocale } from "src/hooks/use-locale";
import { useFeatureFlagsReady } from "src/hooks/use-feature-flags";

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
};

export const useAppReady = (): AppReadyState => {
  const { isLoaded: authLoaded } = useAuth();
  const { isI18nReady } = useLocale();
  const featureFlagsReady = useFeatureFlagsReady();

  const steps: LoadingStep[] = [
    {
      id: "auth",
      isComplete: authLoaded,
    },
    {
      id: "featureFlags",
      isComplete: featureFlagsReady,
    },
    {
      id: "i18n",
      isComplete: isI18nReady,
    },
  ];

  const systemsReady = steps.every((step) => step.isComplete);
  const isReady = hasLoadFlag() ? systemsReady : true;
  const completedSteps = steps.filter((step) => step.isComplete).length;
  const progress = Math.round((completedSteps / steps.length) * 100);

  return {
    isReady,
    progress,
    steps,
  };
};
