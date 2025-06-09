import { LinkBreak1Icon } from "@radix-ui/react-icons";
import { useEffect } from "react";
import { notify } from "./notifications";

export const OfflineGuard = () => {
  useEffect(() => {
    const handleOffline = () => {
      notify.error({
        Icon: LinkBreak1Icon,
        title: "No Internet Connection",
        description: "The map experience may be compromised.",
        id: "offline-error",
      });
    };

    const handleOnline = () => {
      notify.remove("offline-error");
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
