import { CheckIcon } from "@radix-ui/react-icons";
import { useEffect } from "react";
import { notify } from "./notifications";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { Check } from "lucide-react";

type NotificationData = {
  variant: "success" | "warning" | "error";
  title: string;
  description?: string;
  Icon?: React.ElementType;
  size?: "auto" | "sm" | "md";
};

type SupportedTypes = "checkoutSuccess";

export const NotificationFromUrl = () => {
  const translate = useTranslate();
  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");

  const notificationData: Record<SupportedTypes, NotificationData> = {
    checkoutSuccess: {
      variant: "success",
      title: translate("upgradeSuccessful"),
      description: translate("upgradeSuccessfulExplain"),
      Icon: isLucideIconsOn ? Check : CheckIcon,
      size: "md",
    },
  };

  useEffect(() => {
    const messageType = getMessageTypeFromUrl();
    if (!messageType) return;
    const data = notificationData[messageType as SupportedTypes];

    clearUrlParameter();
    notify(data);
  });

  return null;
};

const getMessageTypeFromUrl = () => {
  const query = window.location.search;
  const params = new URLSearchParams(query);
  const type = params.get("notification");
  return type;
};

const clearUrlParameter = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete("notification");

  window.history.replaceState({}, "", url);
};
