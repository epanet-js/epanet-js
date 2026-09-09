import { atom, useAtom } from "jotai";
import { notify } from "src/components/notifications";
import { captureError } from "src/infra/error-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { useAuth } from "src/hooks/use-auth";
import { billingUrl } from "src/global-config";
import { ErrorIcon, WarningIcon } from "src/icons";

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
        if (await isEmailRefused(response)) {
          setLoading(false);
          notify({
            variant: "warning",
            title: translate("trial.emailNotEligible"),
            description: translate("trial.emailNotEligibleDetail"),
            Icon: WarningIcon,
          });
          return false;
        }

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

const isEmailRefused = async (response: Response): Promise<boolean> => {
  try {
    const { reason } = (await response.json()) as { reason?: string };
    return reason === "emailNotEligible";
  } catch {
    return false;
  }
};
