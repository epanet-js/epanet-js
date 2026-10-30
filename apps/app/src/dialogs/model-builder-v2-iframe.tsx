import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import clsx from "clsx";
import { BaseDialog } from "../components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { useAuth } from "src/hooks/use-auth";
import { useLocale } from "src/hooks/use-locale";
import { Loading } from "../components/elements";
import { EarlyAccessBadge } from "../components/early-access-badge";
import { useOpenProjectFile } from "src/commands/open-project";
import { projectExtension } from "src/commands/save-project";
import { useUserTracking, UserEvent } from "src/infra/user-tracking";
import { useShowNetworkReview } from "src/commands/show-network-review";
import {
  useEnabledFeatureFlags,
  useReportFeatureFlagUsage,
} from "src/hooks/use-feature-flags";
import { usePermissions } from "src/hooks/use-permissions";
import { useStartUpgrade } from "src/hooks/use-paywall";
import { modelBuilderV2Url } from "src/global-config";

type ModelBuildAccess = "full" | "limited";

const buildIframeSrc = (
  enabledFlags: string[],
  locale: string,
  access: ModelBuildAccess,
): string => {
  const url = new URL(modelBuilderV2Url);
  for (const flag of enabledFlags) {
    url.searchParams.set(flag, "true");
  }
  url.searchParams.set("locale", locale);
  url.searchParams.set("access", access);
  return url.toString();
};

interface IframeMessage {
  type: string;
  data: {
    source: string;
    [key: string]: any;
  };
}

// v2 hands the built model back as an .ejsdb binary (vs v1's INP text). The
// bytes ride along as a structured-cloned Uint8Array.
interface ModelBuildEjsdbCompleteMessage extends IframeMessage {
  type: "modelBuildEjsdbComplete";
  data: {
    source: "epanet-model-builder";
    ejsdbBytes: Uint8Array;
    projectName?: string;
    timestamp: string;
  };
}

interface TrackUserEventMessage extends IframeMessage {
  type: "trackUserEvent";
  data: {
    source: "epanet-model-builder";
    userEvent: UserEvent;
  };
}

export type ModelBuilderContext = {
  step?: string;
};

interface ContextChangedMessage extends IframeMessage {
  type: "contextChanged";
  data: {
    source: "epanet-model-builder";
    context: ModelBuilderContext;
  };
}

interface OpenExternalLinkMessage extends IframeMessage {
  type: "openExternalLink";
  data: {
    source: "epanet-model-builder";
    url: string;
    timestamp: string;
  };
}

interface FeatureFlagCalledMessage extends IframeMessage {
  type: "featureFlagCalled";
  data: {
    source: "epanet-model-builder";
    name: string;
  };
}

const handleModelBuildEjsdbComplete = async (
  message: ModelBuildEjsdbCompleteMessage,
  userTracking: ReturnType<typeof useUserTracking>,
  openProjectFile: ReturnType<typeof useOpenProjectFile>,
  showNetworkReview: ReturnType<typeof useShowNetworkReview>,
) => {
  if (!message.data.ejsdbBytes) {
    return;
  }

  const { ejsdbBytes, projectName, timestamp } = message.data;
  const name =
    projectName ||
    `model-builder-${new Date(timestamp).toISOString().replace(/[:.]/g, "-")}`;
  const filename = `${name}${projectExtension}`;

  userTracking.capture({
    name: "modelBuilder.completed",
    version: "v2",
  });

  const projectFile = new File([ejsdbBytes], filename, {
    type: "application/octet-stream",
  });

  await openProjectFile(projectFile, "modelBuilder", { isUnsaved: true });
  showNetworkReview({ source: "auto" });
};

const handleUserEvent = (
  message: TrackUserEventMessage,
  userTracking: ReturnType<typeof useUserTracking>,
) => {
  if (!message.data.userEvent) {
    return;
  }

  if (!message.data.userEvent.name) {
    return;
  }

  userTracking.capture(message.data.userEvent);
};

const handleOpenExternalLink = (message: OpenExternalLinkMessage) => {
  if (!message.data.url) {
    return;
  }

  window.open(message.data.url, "_blank", "noopener,noreferrer");
};

export const ModelBuilderV2Frame = ({
  onContextChange,
  onClose,
  className,
}: {
  onContextChange: (context: ModelBuilderContext) => void;
  onClose?: () => void;
  className?: string;
}) => {
  const translate = useTranslate();
  const { locale } = useLocale();
  const [isLoading, setIsLoading] = useState(true);
  const openProjectFile = useOpenProjectFile();
  const userTracking = useUserTracking();
  const showNetworkReview = useShowNetworkReview();
  const enabledFlags = useEnabledFeatureFlags();
  const reportFeatureFlagUsage = useReportFeatureFlagUsage();
  const { canUseModelBuildV2 } = usePermissions();
  const startUpgrade = useStartUpgrade();
  const access: ModelBuildAccess = canUseModelBuildV2 ? "full" : "limited";
  const initialLocale = useRef(locale).current;
  const initialAccess = useRef(access).current;
  const iframeSrc = useMemo(
    () => buildIframeSrc(enabledFlags, initialLocale, initialAccess),
    [enabledFlags, initialLocale, initialAccess],
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const sendLocale = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "localeChanged", data: { locale } },
      new URL(modelBuilderV2Url).origin,
    );
  }, [locale]);

  const sendAccess = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "accessChanged", data: { access } },
      new URL(modelBuilderV2Url).origin,
    );
  }, [access]);

  useEffect(() => {
    sendLocale();
  }, [sendLocale]);

  useEffect(() => {
    sendAccess();
  }, [sendAccess]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as IframeMessage;

      if (!message?.type || !message?.data?.source) {
        return;
      }

      if (message.data.source !== "epanet-model-builder") {
        return;
      }

      if (message.type === "modelBuildEjsdbComplete") {
        void handleModelBuildEjsdbComplete(
          message as ModelBuildEjsdbCompleteMessage,
          userTracking,
          openProjectFile,
          showNetworkReview,
        );
      } else if (message.type === "trackUserEvent") {
        handleUserEvent(message as TrackUserEventMessage, userTracking);
      } else if (message.type === "contextChanged") {
        onContextChange((message as ContextChangedMessage).data.context ?? {});
      } else if (message.type === "openExternalLink") {
        handleOpenExternalLink(message as OpenExternalLinkMessage);
      } else if (message.type === "featureFlagCalled") {
        const { name } = (message as FeatureFlagCalledMessage).data;
        if (typeof name === "string" && name) reportFeatureFlagUsage(name);
      } else if (message.type === "requestUpgrade") {
        startUpgrade("modelBuildAdvanced");
      } else if (message.type === "close") {
        onClose?.();
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [
    openProjectFile,
    userTracking,
    showNetworkReview,
    reportFeatureFlagUsage,
    onContextChange,
    onClose,
    startUpgrade,
  ]);

  return (
    <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-base z-10">
          <Loading />
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        className={clsx("w-full flex-1 border-0", className)}
        onLoad={() => {
          setIsLoading(false);
          sendLocale();
          sendAccess();
        }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
        title={translate("importFromGIS")}
      />
    </div>
  );
};

export const ModelBuilderV2IframeDialog = ({
  onClose: _onClose,
}: {
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const context = useRef<ModelBuilderContext>({});
  const userTracking = useUserTracking();
  const { isSignedIn, isLoaded } = useAuth();
  const showEarlyAccess = isLoaded && !isSignedIn;

  const handleContextChange = useCallback((newContext: ModelBuilderContext) => {
    context.current = newContext;
  }, []);

  const handleClose = () => {
    userTracking.capture({
      name: "modelBuilder.closed",
      step: context.current.step ?? null,
    });
    _onClose();
  };

  return (
    <BaseDialog
      title={translate("importFromGIS")}
      size="xxl"
      height="xxl"
      isOpen={true}
      onClose={handleClose}
      badge={showEarlyAccess ? <EarlyAccessBadge /> : undefined}
    >
      <ModelBuilderV2Frame
        onContextChange={handleContextChange}
        className="rounded-bl-lg rounded-br-lg"
      />
    </BaseDialog>
  );
};
