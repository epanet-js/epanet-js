import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { dialogAtom } from "src/state/dialog_state";
import { useOpenInp } from "./open-inp";

export const useOpenInpFromUrl = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const { openInpFromCandidates } = useOpenInp();
  const openInpFromUrl = useCallback(
    async (url: string) => {
      setDialogState({ type: "loading" });

      const response = await fetch(url);
      const name = parseName(url);
      const inpFile = new File([await response.blob()], name);
      openInpFromCandidates([inpFile]);
    },
    [setDialogState],
  );

  return { openInpFromUrl };
};

const parseName = (url: string): string => {
  return url.split("/").pop() || "my-network.inp";
};
