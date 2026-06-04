import { useState, useEffect } from "react";
import { BaseDialog } from "../components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { Loading } from "../components/elements";
import { EarlyAccessBadge } from "../components/early-access-badge";
import { useOpenProjectFile } from "src/commands/open-project";
import { projectExtension } from "src/commands/save-project";
import { useUnsavedChangesCheck } from "src/commands/check-unsaved-changes";
import { useUserTracking, UserEvent } from "src/infra/user-tracking";
import { useToggleNetworkReview } from "src/commands/toggle-network-review";
import { modelBuilderV2Url } from "src/global-config";

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

interface OpenExternalLinkMessage extends IframeMessage {
  type: "openExternalLink";
  data: {
    source: "epanet-model-builder";
    url: string;
    timestamp: string;
  };
}

const handleModelBuildEjsdbComplete = (
  message: ModelBuildEjsdbCompleteMessage,
  userTracking: ReturnType<typeof useUserTracking>,
  checkUnsavedChanges: ReturnType<typeof useUnsavedChangesCheck>,
  openProjectFile: ReturnType<typeof useOpenProjectFile>,
  toggleNetworkReview: ReturnType<typeof useToggleNetworkReview>,
) => {
  if (!message.data.ejsdbBytes) {
    return;
  }

  const { ejsdbBytes, timestamp } = message.data;
  const filename = `model-builder-${new Date(timestamp).toISOString().replace(/[:.]/g, "-")}${projectExtension}`;

  userTracking.capture({
    name: "modelBuilder.completed",
  });

  const projectFile = new File([ejsdbBytes], filename, {
    type: "application/octet-stream",
  });

  checkUnsavedChanges(async () => {
    await openProjectFile(projectFile, "modelBuilder");
    toggleNetworkReview({ source: "auto", state: true });
  });
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

export const ModelBuilderV2IframeDialog = ({
  onClose: _onClose,
}: {
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const [isLoading, setIsLoading] = useState(true);
  const openProjectFile = useOpenProjectFile();
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const userTracking = useUserTracking();
  const toggleNetworkReview = useToggleNetworkReview();

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
        handleModelBuildEjsdbComplete(
          message as ModelBuildEjsdbCompleteMessage,
          userTracking,
          checkUnsavedChanges,
          openProjectFile,
          toggleNetworkReview,
        );
      } else if (message.type === "trackUserEvent") {
        handleUserEvent(message as TrackUserEventMessage, userTracking);
      } else if (message.type === "openExternalLink") {
        handleOpenExternalLink(message as OpenExternalLinkMessage);
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [openProjectFile, checkUnsavedChanges, userTracking, toggleNetworkReview]);

  return (
    <BaseDialog
      title={translate("importFromGIS")}
      size="xxl"
      height="xxl"
      isOpen={true}
      onClose={_onClose}
      badge={<EarlyAccessBadge />}
    >
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-base z-10">
            <Loading />
          </div>
        )}
        <iframe
          src={modelBuilderV2Url}
          className="w-full flex-1 border-0 rounded-bl-lg rounded-br-lg"
          onLoad={() => setIsLoading(false)}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
          title={translate("importFromGIS")}
        />
      </div>
    </BaseDialog>
  );
};
