"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { openLegitFsWithMemoryFs } from "@legit-sdk/core";
import { captureError } from "src/infra/error-tracking";

type LegitFs = Awaited<ReturnType<typeof openLegitFsWithMemoryFs>>;

export const LegitFsContext = createContext<LegitFs | null>(null);

export function useLegitFs() {
  return useContext(LegitFsContext);
}

export function LegitFsProvider({ children }: { children: React.ReactNode }) {
  const [fs, setFs] = useState<LegitFs | null>(null);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    void (async () => {
      try {
        // @ts-expect-error - this is a valid configuration the type needs a fix
        const openedFs = await openLegitFsWithMemoryFs({
          anonymousBranch: "main",
        });
        setFs(openedFs);
      } catch (error) {
        captureError(error as Error);
      }
    })();
  }, []);

  useEffect(() => {
    if (fs) {
      // void (async () => {
      //   try {
      //     await fs.promises.mkdir(`/.legit/branches/main`);
      //   } catch (error) {
      //     captureError(error as Error);
      //   }
      //   void fs.setCurrentBranch("main");
      // })();

      (window as unknown as { legitFs: LegitFs }).legitFs = fs;
    }
  }, [fs]);

  return (
    <LegitFsContext.Provider value={fs}>{children}</LegitFsContext.Provider>
  );
}
