import { Link1Icon, LinkBreak1Icon } from "@radix-ui/react-icons";
import { useCallback, useEffect, useRef } from "react";
import { hideNotification, notify } from "./notifications";
import { isFeatureOn } from "src/infra/feature-flags";

const offlineToastId = "offline-toast";
const onlineToastId = "online-toast";
const pingUrl = "https://www.cloudflare.com/cdn-cgi/trace";

export const useOfflineStatus = () => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isOfflineRef = useRef<boolean>(false);

  const cancelConnectivityCheck = useCallback(() => {
    if (!intervalRef.current) return;
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const setOnline = useCallback(() => {
    if (!isOfflineRef.current) return;

    isOfflineRef.current = false;
    hideNotification(offlineToastId);
    notify({
      variant: "success",
      title: "Connection restored!",
      Icon: Link1Icon,
      dismissable: false,
      duration: 3000,
      id: onlineToastId,
      position: "bottom-right",
    });
  }, []);

  const setOffline = useCallback(() => {
    if (isOfflineRef.current) return;

    isOfflineRef.current = true;
    hideNotification(onlineToastId);
    notify({
      variant: "warning",
      Icon: LinkBreak1Icon,
      title: "No Internet Connection",
      description: "Some features may not be available.",
      duration: Infinity,
      dismissable: false,
      id: offlineToastId,
      position: "bottom-right",
    });
  }, []);

  const startConnectivityCheck = useCallback(() => {
    if (!isFeatureOn("FLAG_OFFLINE_ERROR")) return;
    if (intervalRef.current) return;

    intervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(pingUrl, {
          method: "HEAD",
        });
        if (response.ok) {
          setOnline();
          return;
        } else {
          setOffline();
        }
      } catch (e) {
        setOffline();
      }
    }, 5000);
  }, [setOnline, setOffline]);

  return { startConnectivityCheck, cancelConnectivityCheck, setOffline };
};

export const OfflineGuard = () => {
  const { startConnectivityCheck, cancelConnectivityCheck, setOffline } =
    useOfflineStatus();

  useEffect(() => {
    const handleOffline = () => {
      setOffline();
    };

    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("offline", handleOffline);
    };
  }, [setOffline]);

  useEffect(() => {
    startConnectivityCheck();

    return () => {
      cancelConnectivityCheck();
    };
  }, [startConnectivityCheck, cancelConnectivityCheck]);

  return null;
};
