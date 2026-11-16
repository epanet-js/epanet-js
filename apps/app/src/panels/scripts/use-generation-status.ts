import { useEffect, useState } from "react";
import { useTranslate } from "src/hooks/use-translate";
import type { ScriptGeneration } from "./use-script-generation";

type Step = { afterMs: number; key: string };

const progress = (key: string) => `scripting.assistant.progress.${key}`;

const steps: Record<ScriptGeneration["kind"], Step[]> = {
  write: [
    { afterMs: 0, key: "scripting.assistant.writing" },
    { afterMs: 3_000, key: progress("readingRequest") },
    { afterMs: 7_000, key: progress("checkingApi") },
    { afterMs: 12_000, key: progress("planningScript") },
    { afterMs: 18_000, key: progress("writingCode") },
    { afterMs: 26_000, key: progress("addingComments") },
    { afterMs: 35_000, key: progress("reviewing") },
    { afterMs: 50_000, key: progress("stillWorking") },
    { afterMs: 80_000, key: progress("almostDone") },
  ],
  update: [
    { afterMs: 0, key: "scripting.assistant.updating" },
    { afterMs: 3_000, key: progress("readingScript") },
    { afterMs: 7_000, key: progress("planningChanges") },
    { afterMs: 12_000, key: progress("checkingApi") },
    { afterMs: 18_000, key: progress("applyingChanges") },
    { afterMs: 26_000, key: progress("keepingRestIntact") },
    { afterMs: 35_000, key: progress("reviewing") },
    { afterMs: 50_000, key: progress("stillWorking") },
    { afterMs: 80_000, key: progress("almostDone") },
  ],
};

export const useGenerationStatus = (
  generation: ScriptGeneration | null,
): string | null => {
  const translate = useTranslate();
  const [shown, setShown] = useState({ generation, index: 0 });
  if (shown.generation !== generation) setShown({ generation, index: 0 });

  useEffect(() => {
    if (!generation) return;
    const timers = steps[generation.kind]
      .slice(1)
      .map(({ afterMs }, i) =>
        setTimeout(() => setShown({ generation, index: i + 1 }), afterMs),
      );
    return () => timers.forEach(clearTimeout);
  }, [generation]);

  if (!generation) return null;
  const index = shown.generation === generation ? shown.index : 0;
  return translate(steps[generation.kind][index].key);
};
