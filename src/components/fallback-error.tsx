import { useUserTracking } from "src/infra/user-tracking";
import { Button } from "./elements";
import { supportEmail } from "src/global-config";
import { useTranslate } from "src/hooks/use-translate";
import { ErrorIcon } from "src/icons";

export const FallbackError = () => {
  const translate = useTranslate();
  const userTracking = useUserTracking();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 text-white p-6">
      <div className="bg-white text-gray-900 rounded-lg p-4 shadow-lg w-full max-w-lg">
        <span className="flex items-center gap-x-2 text-xl text-black mb-4">
          <ErrorIcon />
          {translate("oopsSomethingWrong")}
        </span>

        <p className="text-sm mb-4">
          {translate("errorProcessingRequest")} {translate("pleaseTryAgain")}{" "}
          <a href={`mailto:${supportEmail}`} className="text-purple-800">
            {supportEmail}
          </a>
          .
        </p>
        <div className="flex items-center justify-end">
          <Button
            variant="primary"
            onClick={() => {
              userTracking.capture({
                name: "page.reloaded",
                source: "errorFallback",
              });
              window.location.reload();
            }}
          >
            {translate("reloadPage")}
          </Button>
        </div>
      </div>
    </div>
  );
};
