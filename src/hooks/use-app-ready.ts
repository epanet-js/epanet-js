import { useAuth } from "src/auth";
import { useLocale } from "src/hooks/use-locale";
import { useFeatureFlagsReady } from "src/hooks/use-feature-flags";
import { useEffect, useRef, useState } from "react";

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
  const [progress, setProgress] = useState(0);

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
  const isLoading = useRef<boolean>(false);

  useEffect(() => {
    if (isLoading.current) return;

    isLoading.current = true;

    setProgress(0);

    const animateProgress = async (nextProgress: number) => {
      setProgress(nextProgress);
      await new Promise((resolve) => setTimeout(resolve, 50));

      if (nextProgress < 100) {
        void animateProgress(Math.min(100, nextProgress + 20));
      } else {
        setTimeout(() => {
          setProgress(0);
          isLoading.current = false;
        }, 100);
      }
    };

    void animateProgress(0);
  }, [systemsReady]);

  const displayProgress = Math.min(progress, 100);

  return {
    isReady: !isLoading.current && systemsReady,
    progress: displayProgress,
    steps,
  };
};
