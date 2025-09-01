import { Link1Icon, LinkBreak1Icon } from "@radix-ui/react-icons";
import { useCallback, useEffect, useRef } from "react";
import { hideNotification, notify } from "./notifications";
import { useTranslate } from "src/hooks/use-translate";
import { useSetAtom } from "jotai";
import { offlineAtom } from "src/state/offline";
import { pingUrl } from "src/global-config";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { Link2, Link2Off } from "lucide-react";

const offlineToastId = "offline-toast";
const onlineToastId = "online-toast";
const intervalMs = 10 * 1000;

export const useOfflineStatus = () => {
  const translate = useTranslate();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const setOfflineAtom = useSetAtom(offlineAtom);
  const isOfflineRef = useRef<boolean>(false);
  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");

  const cancelConnectivityCheck = useCallback(() => {
    if (!intervalRef.current) return;
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const setOnline = useCallback(() => {
    if (!isOfflineRef.current) return;

    isOfflineRef.current = false;
    setOfflineAtom(false);
    hideNotification(offlineToastId);
    notify({
      variant: "success",
      title: translate("connectionRestored"),
      Icon: isLucideIconsOn ? Link2 : Link1Icon,
      dismissable: false,
      duration: 3000,
      id: onlineToastId,
      position: "bottom-right",
      size: "sm",
    });
  }, [setOfflineAtom, translate, isLucideIconsOn]);

  const setOffline = useCallback(() => {
    if (isOfflineRef.current) return;

    isOfflineRef.current = true;
    setOfflineAtom(true);
    hideNotification(onlineToastId);
    notify({
      variant: "warning",
      Icon: isLucideIconsOn ? Link2Off : LinkBreak1Icon,
      title: translate("noInternet"),
      description: translate("noInternetExplain"),
      duration: Infinity,
      dismissable: false,
      id: offlineToastId,
      position: "bottom-right",
      size: "sm",
    });
  }, [setOfflineAtom, translate, isLucideIconsOn]);

  const startConnectivityCheck = useCallback(() => {
    if (intervalRef.current) return;

    intervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(pingUrl, {
          cache: "no-cache",
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
    }, intervalMs);
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
