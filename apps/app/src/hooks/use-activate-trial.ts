import { atom, useAtom } from "jotai";
import { notify } from "src/components/notifications";
import { captureError } from "src/infra/error-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { useAuth } from "src/hooks/use-auth";
import { billingUrl } from "src/global-config";
import { ErrorIcon } from "src/icons";

const activateTrialLoadingAtom = atom<boolean>(false);

export const useActivateTrial = () => {
  const translate = useTranslate();
  const [isLoading, setLoading] = useAtom(activateTrialLoadingAtom);
  const { reload } = useAuth();

  const activateTrial = async (): Promise<boolean> => {
    setLoading(true);
    try {
      const response = await fetch(`${billingUrl}/trial`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Trial activation failed: ${response.statusText}`);
      }

      await reload();
      setLoading(false);
      return true;
    } catch (error) {
      setLoading(false);
      captureError(error as Error);
      notify({
        variant: "error",
        title: translate("somethingWentWrong"),
        description: translate("tryAgainOrSupport"),
        Icon: ErrorIcon,
      });
      return false;
    }
  };

  return { activateTrial, isLoading };
};
