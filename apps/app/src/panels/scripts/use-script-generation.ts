import { useCallback, useEffect, useRef, useState } from "react";
import { notify } from "src/components/notifications";
import { useAuth } from "src/hooks/use-auth";
import { ErrorIcon } from "src/icons";
import { captureError, captureWarning } from "src/infra/error-tracking";
import {
  getScriptAssistant,
  type ScriptAssistantFailure,
  type ScriptAssistantRequest,
  type WrittenScript,
} from "src/lib/script-assistant";

export type ScriptGeneration = {
  prompt: string;
  kind: "write" | "update";
};

const failureMessages: Record<
  ScriptAssistantFailure,
  { title: string; description: string }
> = {
  signedOut: {
    title: "You're signed out",
    description: "Sign in again, then send your request.",
  },
  notEnabled: {
    title: "The assistant isn't enabled for your account",
    description: "Contact support to get access.",
  },
  limitReached: {
    title: "You've used all your assistant credit",
    description: "Contact support to add more.",
  },
  tooLong: {
    title: "This request is too long",
    description: "Shorten your message or the script, then try again.",
  },
  unavailable: {
    title: "We couldn't write the script",
    description: "Try again. If the error persists, contact support.",
  },
};

const notifyFailure = (reason: ScriptAssistantFailure) =>
  notify({
    variant: "error",
    Icon: ErrorIcon,
    id: "script-assistant-failure",
    ...failureMessages[reason],
  });

const reportFailure = (reason: ScriptAssistantFailure, detail: string) => {
  if (reason === "unavailable") {
    captureError(new Error(`The script assistant failed: ${detail}`));
  } else {
    captureWarning(`The script assistant refused: ${detail}`);
  }
};

export const useScriptGeneration = () => {
  const { getToken } = useAuth();
  const [generation, setGeneration] = useState<ScriptGeneration | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setGeneration(null);
  }, []);

  const generate = useCallback(
    async (request: ScriptAssistantRequest): Promise<WrittenScript | null> => {
      const assistant = getScriptAssistant();
      if (!assistant) return null;

      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setGeneration({
        prompt: request.prompt,
        kind: request.source.trim() === "" ? "write" : "update",
      });

      try {
        const token = await getToken();
        const result = await assistant.writeScript(request, {
          signal: controller.signal,
          token,
        });
        if (controller.signal.aborted) return null;
        if (result.status === "written") return result.script;

        reportFailure(result.reason, result.detail);
        notifyFailure(result.reason);
        return null;
      } catch (error) {
        if (!controller.signal.aborted) {
          captureError(error as Error);
          notifyFailure("unavailable");
        }
        return null;
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
          setGeneration(null);
        }
      }
    },
    [getToken],
  );

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { generation, generate, stop };
};
