import { atom, useAtom } from "jotai";
import { notify } from "src/components/notifications";
import { captureError } from "src/infra/error-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { ErrorIcon } from "src/icons";

const activateTrialLoadingAtom = atom<boolean>(false);

export const useActivateTrial = () => {
  const translate = useTranslate();
  const [isLoading, setLoading] = useAtom(activateTrialLoadingAtom);

  const activateTrial = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/activate-trial", { method: "POST" });

      if (!response.ok) {
        throw new Error(`Trial activation failed: ${response.statusText}`);
      }

      window.location.reload();
    } catch (error) {
      setLoading(false);
      captureError(error as Error);
      notify({
        variant: "error",
        title: translate("somethingWentWrong"),
        description: translate("tryAgainOrSupport"),
        Icon: ErrorIcon,
      });
    }
  };

  return { activateTrial, isLoading };
};
