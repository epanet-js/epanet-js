import { LinkBreak1Icon } from "@radix-ui/react-icons";
import { useEffect } from "react";
import { hideNotification, notify } from "./notifications";

export const OfflineGuard = () => {
  useEffect(() => {
    const handleOffline = () => {
      notify({
        variant: "error",
        Icon: LinkBreak1Icon,
        title: "No Internet Connection",
        description: "The map experience may be compromised.",
        id: "offline-error",
      });
    };

    const handleOnline = () => {
      hideNotification("offline-error");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return null;
};
