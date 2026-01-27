import { useState, useEffect } from "react";
import { DialogContainer, DialogHeader } from "../dialog";
import { useTranslate } from "src/hooks/use-translate";
import { Loading } from "../elements";
import { EarlyAccessBadge } from "../early-access-badge";
import { useImportInp } from "src/commands/import-inp";
import { useUnsavedChangesCheck } from "src/commands/check-unsaved-changes";
import { useUserTracking, UserEvent } from "src/infra/user-tracking";
import { useToggleNetworkReview } from "src/commands/toggle-network-review";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { modelBuilderUrl } from "src/global-config";
import { GlobeIcon } from "src/icons";

interface IframeMessage {
  type: string;
  data: {
    source: string;
    [key: string]: any;
  };
}

interface ModelBuildCompleteMessage extends IframeMessage {
  type: "modelBuildComplete";
  data: {
    source: "epanet-model-builder";
    inpContent: string;
    timestamp: number;
  };
}

interface TrackUserEventMessage extends IframeMessage {
  type: "trackUserEvent";
  data: {
    source: "epanet-model-builder";
    userEvent: UserEvent;
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

const handleModelBuildComplete = (
  message: ModelBuildCompleteMessage,
  userTracking: ReturnType<typeof useUserTracking>,
  checkUnsavedChanges: ReturnType<typeof useUnsavedChangesCheck>,
  importInp: ReturnType<typeof useImportInp>,
  toggleNetworkReview: ReturnType<typeof useToggleNetworkReview>,
  autoOpenNetworkReview: boolean,
) => {
  if (!message.data.inpContent) {
    return;
  }

  const { inpContent, timestamp } = message.data;
  const filename = `model-builder-${new Date(timestamp).toISOString().replace(/[:.]/g, "-")}.inp`;

  userTracking.capture({
    name: "modelBuilder.completed",
  });

  setTimeout(() => {
    const inpFile = new File([inpContent], filename, {
      type: "text/plain",
    });

    checkUnsavedChanges(() => {
      void importInp([inpFile]);
      if (autoOpenNetworkReview) {
        toggleNetworkReview({ source: "auto", state: true });
      }
    });
  }, 1000);
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

export const ModelBuilderIframeDialog = ({
  onClose: _onClose,
}: {
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const [isLoading, setIsLoading] = useState(true);
  const importInp = useImportInp();
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const userTracking = useUserTracking();
  const toggleNetworkReview = useToggleNetworkReview();
  const autoOpenNetworkReview = useFeatureFlag("FLAG_AUTO_NETWORK_REVIEW");
  const isMdOrLarger = useBreakpoint("md");

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const message = event.data as IframeMessage;

        if (!message?.type || !message?.data?.source) {
          return;
        }

        if (message.data.source !== "epanet-model-builder") {
          return;
        }

        if (message.type === "modelBuildComplete") {
          handleModelBuildComplete(
            message as ModelBuildCompleteMessage,
            userTracking,
            checkUnsavedChanges,
            importInp,
            toggleNetworkReview,
            autoOpenNetworkReview,
          );
        } else if (message.type === "trackUserEvent") {
          handleUserEvent(message as TrackUserEventMessage, userTracking);
        } else if (message.type === "openExternalLink") {
          handleOpenExternalLink(message as OpenExternalLinkMessage);
        }
      } catch (error) {
        throw error;
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [
    importInp,
    checkUnsavedChanges,
    userTracking,
    toggleNetworkReview,
    autoOpenNetworkReview,
  ]);
  return (
    <DialogContainer size={isMdOrLarger ? "xl" : "fullscreen"}>
      <DialogHeader
        title={translate("importFromGIS")}
        titleIcon={GlobeIcon}
        badge={<EarlyAccessBadge />}
      />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900 z-10">
            <Loading />
          </div>
        )}
        <iframe
          src={modelBuilderUrl}
          className="w-full flex-1 border-0 rounded"
          onLoad={() => setIsLoading(false)}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
          title={translate("importFromGIS")}
        />
      </div>
    </DialogContainer>
  );
};
