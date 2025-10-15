import { ChevronLeftIcon } from "lucide-react";
import { useCallback } from "react";
import { Button } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { NoIssuesIcon } from "src/icons";

export const enum CheckType {
  connectivityTrace = "connectivityTrace",
  orphanAssets = "orphanAssets",
  proximityCheck = "proximityCheck",
  crossingPipes = "crossingPipes",
}

export const ToolHeader = ({
  onGoBack,
  itemsCount,
  checkType,
}: {
  onGoBack: () => void;
  itemsCount: number;
  checkType: CheckType;
}) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();

  const goBack = useCallback(() => {
    userTracking.capture({
      name: `networkReview.${checkType}.back`,
      count: itemsCount,
    });
    onGoBack();
  }, [onGoBack, userTracking, itemsCount, checkType]);

  return (
    <div
      className="grid gap-x-1 items-start w-full border-b-2 border-gray-100 pl-1 py-3"
      style={{
        gridTemplateColumns: "auto 1fr",
      }}
    >
      <Button
        className="mt-[-.25rem] py-1.5"
        size="xs"
        variant={"quiet"}
        role="button"
        aria-label={translate("back")}
        onClick={goBack}
      >
        <ChevronLeftIcon size={16} />
      </Button>
      <div className="w-full flex-col">
        <p className="text-sm font-bold text-gray-900 dark:text-white">
          {translate(`networkReview.${checkType}.title`)}
        </p>
        <Summary checkType={checkType} count={itemsCount} />
      </div>
    </div>
  );
};

const Summary = ({
  count,
  checkType,
}: {
  count: number;
  checkType: CheckType;
}) => {
  const translate = useTranslate();
  const message = translate(`networkReview.${checkType}.summary`, count);
  return <p className="text-gray-500 text-sm">{message}</p>;
};

export const ToolDescription = ({ checkType }: { checkType: CheckType }) => {
  const translate = useTranslate();
  return (
    <p className="text-sm w-full p-3">
      {translate(`networkReview.${checkType}.description`)}
    </p>
  );
};

export const EmptyState = ({ checkType }: { checkType: CheckType }) => {
  const translate = useTranslate();
  return (
    <div className="flex-grow flex flex-col items-center justify-center px-4 pb-4">
      <div className="text-green-600">
        <NoIssuesIcon size={96} />
      </div>
      <p className="text-sm text-center py-4 text-gray-600 max-w-48">
        {translate(`networkReview.${checkType}.emptyMessage`)}
      </p>
    </div>
  );
};
