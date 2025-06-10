import { Link1Icon, LinkBreak1Icon } from "@radix-ui/react-icons";
import { useCallback, useEffect } from "react";
import { hideNotification, notify } from "./notifications";
import { atom, useAtom } from "jotai";

export const offlineAtom = atom<boolean | undefined>(undefined);

const offlineToastId = "offline-toast";
const onlineToastId = "online-toast";

export const useOfflineStatus = () => {
  const [isOffline, setOfflineAtom] = useAtom(offlineAtom);

  const setOffline = useCallback(() => {
    if (isOffline) return;

    setOfflineAtom(true);
    hideNotification(onlineToastId);
    notify({
      variant: "warning",
      Icon: LinkBreak1Icon,
      title: "No Internet Connection",
      description: "Some features may not be available.",
      duration: Infinity,
      dismissable: false,
      id: offlineToastId,
    });
  }, [isOffline, setOfflineAtom]);

  const setOnline = useCallback(() => {
    if (!isOffline) return;

    setOfflineAtom(false);
    hideNotification(offlineToastId);
    notify({
      variant: "success",
      title: "Connection restored!",
      Icon: Link1Icon,
      duration: 3000,
    });
  }, [isOffline, setOfflineAtom]);

  return { setOnline, setOffline };
};

export const OfflineGuard = () => {
  const { setOffline, setOnline } = useOfflineStatus();

  useEffect(() => {
    const handleOffline = () => {
      setOffline();
    };

    const handleOnline = () => {
      setOnline();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [setOffline, setOnline]);

  return null;
};
