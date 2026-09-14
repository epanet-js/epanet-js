import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { notify } from "src/components/notifications";
import { captureError } from "src/infra/error-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { useAuth } from "src/hooks/use-auth";
import { billingUrl } from "src/global-config";
import { ErrorIcon, SuccessIcon, WarningIcon } from "src/icons";

const activateTrialLoadingAtom = atom<boolean>(false);

export const trialAfterSignInAtom = atom<boolean>(false);

const refusedTrialEmailsAtom = atomWithStorage<string[]>(
  "refusedTrialEmails",
  [],
);

export const useIsTrialEmailRefused = (): boolean => {
  const { user } = useAuth();
  const refusedEmails = useAtomValue(refusedTrialEmailsAtom);

  return refusedEmails.includes(user.email);
};

export const useActivateTrial = () => {
  const translate = useTranslate();
  const [isLoading, setLoading] = useAtom(activateTrialLoadingAtom);
  const setRefusedEmails = useSetAtom(refusedTrialEmailsAtom);
  const { user, reload } = useAuth();

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
          setRefusedEmails((emails) =>
            emails.includes(user.email) ? emails : [...emails, user.email],
          );
          notify({
            variant: "warning",
            title: translate("trial.emailNotEligible"),
            description: translate("trial.emailNotEligibleDetail"),
            Icon: WarningIcon,
            duration: Infinity,
          });
          return false;
        }

        throw new Error(`Trial activation failed: ${response.statusText}`);
      }

      await reload();
      setLoading(false);
      notify({
        variant: "success",
        title: translate("trial.activated"),
        Icon: SuccessIcon,
        duration: 3000,
      });
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
