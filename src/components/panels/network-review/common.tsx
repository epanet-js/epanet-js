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
      className="grid gap-x-1 items-start w-full border-b-2 border-gray-100 pl-1 pt-1"
      style={{
        gridTemplateColumns: "auto 1fr",
      }}
    >
      <Button
        size="xs"
        className="py-3"
        variant={"quiet"}
        role="button"
        aria-label={translate("back")}
        onClick={goBack}
      >
        <div className="pt-[.125rem]">
          <ChevronLeftIcon size={16} />
        </div>
      </Button>
      <div className="w-full flex-col py-3 ">
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
    <div className="flex-grow">
      <div className="flex flex-col items-center justify-center p-4">
        <div className="text-gray-300">
          <NoIssuesIcon size={96} strokeWidth={1.75} />
        </div>
        <p className="text-center pt-4 font-bold text-gray-400">
          {translate(`networkReview.${checkType}.emptyMessage`)}
        </p>
      </div>
    </div>
  );
};
