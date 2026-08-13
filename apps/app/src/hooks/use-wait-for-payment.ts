import { useEffect, useRef } from "react";
import { useAuth } from "src/hooks/use-auth";

const POLL_INTERVAL_MS = 3000;
const POLL_WINDOW_MS = 1 * 60 * 1000;

export const useWaitForPayment = (onPaymentDetected: () => void) => {
  const { user, reload } = useAuth();

  const initialPlanRef = useRef(user.plan);
  const reloadRef = useRef(reload);
  const onPaymentDetectedRef = useRef(onPaymentDetected);

  reloadRef.current = reload;
  onPaymentDetectedRef.current = onPaymentDetected;

  useEffect(() => {
    if (user.plan === initialPlanRef.current) return;

    onPaymentDetectedRef.current();
  }, [user.plan]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (intervalId === null) return;

      clearInterval(intervalId);
      intervalId = null;
    };

    const start = () => {
      if (intervalId !== null) return;

      const deadline = Date.now() + POLL_WINDOW_MS;
      intervalId = setInterval(() => {
        if (Date.now() > deadline) {
          stop();
          return;
        }

        void reloadRef.current();
      }, POLL_INTERVAL_MS);
    };

    const restartWhenVisible = () => {
      if (document.hidden) return;

      start();
    };

    start();
    document.addEventListener("visibilitychange", restartWhenVisible);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", restartWhenVisible);
    };
  }, []);
};
