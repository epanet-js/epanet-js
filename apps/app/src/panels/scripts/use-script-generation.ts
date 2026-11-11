import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "src/hooks/use-auth";
import { captureError, captureWarning } from "src/infra/error-tracking";
import { useUserTracking } from "src/infra/user-tracking";
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

const reportFailure = (reason: ScriptAssistantFailure, detail: string) => {
  if (reason === "unavailable") {
    captureError(new Error(`The script assistant failed: ${detail}`));
  } else {
    captureWarning(`The script assistant refused: ${detail}`);
  }
};

export const useScriptGeneration = () => {
  const { getToken } = useAuth();
  const userTracking = useUserTracking();
  const [generation, setGeneration] = useState<ScriptGeneration | null>(null);
  const [failure, setFailure] = useState<ScriptAssistantFailure | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setGeneration(null);
    setFailure(null);
  }, []);

  const generate = useCallback(
    async (request: ScriptAssistantRequest): Promise<WrittenScript | null> => {
      const assistant = getScriptAssistant();
      if (!assistant) return null;

      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const kind = request.source.trim() === "" ? "write" : "update";
      const startedAt = performance.now();
      const captureFinished = (
        status: "written" | "failed" | "stopped",
        reason = "",
      ) =>
        userTracking.capture({
          name: "script.generationFinished",
          kind,
          status,
          reason,
          durationMs: Math.round(performance.now() - startedAt),
        });

      setGeneration({ prompt: request.prompt, kind });
      setFailure(null);
      userTracking.capture({
        name: "script.generationRequested",
        kind,
        scope: request.scope,
        promptLength: request.prompt.length,
      });

      try {
        const token = await getToken();
        const result = await assistant.writeScript(request, {
          signal: controller.signal,
          token,
        });
        if (controller.signal.aborted) {
          captureFinished("stopped");
          return null;
        }
        if (result.status === "written") {
          captureFinished("written");
          return result.script;
        }

        captureFinished("failed", result.reason);
        reportFailure(result.reason, result.detail);
        setFailure(result.reason);
        return null;
      } catch (error) {
        if (controller.signal.aborted) {
          captureFinished("stopped");
          return null;
        }
        captureFinished("failed", "unavailable");
        captureError(error as Error);
        setFailure("unavailable");
        return null;
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
          setGeneration(null);
        }
      }
    },
    [getToken, userTracking],
  );

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { generation, failure, generate, stop };
};
