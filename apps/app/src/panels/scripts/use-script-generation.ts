import { useCallback, useEffect, useRef, useState } from "react";
import { captureError } from "src/infra/error-tracking";
import {
  getScriptAssistant,
  type ScriptAssistantRequest,
  type WrittenScript,
} from "src/lib/script-assistant";

export type ScriptGeneration = {
  prompt: string;
  kind: "write" | "update";
};

export const useScriptGeneration = () => {
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
        const written = await assistant.writeScript(request, {
          signal: controller.signal,
        });
        return controller.signal.aborted ? null : written;
      } catch (error) {
        if (!controller.signal.aborted) captureError(error as Error);
        return null;
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
          setGeneration(null);
        }
      }
    },
    [],
  );

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { generation, generate, stop };
};
