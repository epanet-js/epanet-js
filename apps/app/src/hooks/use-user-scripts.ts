import { useAtom } from "jotai";
import { useCallback } from "react";
import { nanoid } from "src/lib/id";
import { userScriptsAtom, type UserScript } from "src/state/scripts";

export const useUserScripts = () => {
  const [scripts, setScripts] = useAtom(userScriptsAtom);

  const saveScript = useCallback(
    (script: { id: string | null; name: string; source: string }) => {
      const saved: UserScript = {
        id: script.id ?? nanoid(),
        name: script.name,
        source: script.source,
        updatedAt: Date.now(),
      };
      setScripts((current) => [
        saved,
        ...current.filter((existing) => existing.id !== saved.id),
      ]);
      return saved;
    },
    [setScripts],
  );

  const deleteScript = useCallback(
    (id: string) =>
      setScripts((current) => current.filter((script) => script.id !== id)),
    [setScripts],
  );

  return { scripts, saveScript, deleteScript };
};
