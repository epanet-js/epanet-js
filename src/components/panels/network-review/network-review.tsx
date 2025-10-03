import { Button } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import {
  ChevronRightIcon,
  ConnectivityTraceIcon,
  OrphanNodeIcon,
  PipesCrossinIcon,
  ProximityCheckIcon,
} from "src/icons";

export function NetworkReview() {
  const translate = useTranslate();
  return (
    <div className="flex-auto overflow-y-auto placemark-scrollbar">
      <div className="py-3 px-4 w-full text-sm font-bold text-gray-900 dark:text-white border-b-2 border-gray-100">
        {translate("networkReview.title")}
      </div>
      <div className="px-4 py-2 text-sm">
        {translate("networkReview.description")}
      </div>
      <div className="flex-auto px-1">
        <ReviewCheck
          icon={<ConnectivityTraceIcon />}
          label={translate("networkReview.connectivityTrace.title")}
        />
        <ReviewCheck
          icon={<OrphanNodeIcon />}
          label={translate("networkReview.orphanNodes.title")}
        />
        <ReviewCheck
          icon={<ProximityCheckIcon />}
          label={translate("networkReview.proximityCheck.title")}
        />
        <ReviewCheck
          icon={<PipesCrossinIcon />}
          label={translate("networkReview.crossingPipes.title")}
        />
      </div>
    </div>
  );
}

const ReviewCheck = ({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick?: () => void;
  icon: React.ReactNode;
}) => {
  return (
    <Button
      onClick={onClick}
      variant={"quiet/mode"}
      role="button"
      aria-label={label}
      className="group w-full"
    >
      <div
        className="grid gap-x-2 items-start p-2 pr-0 text-sm w-full"
        style={{
          gridTemplateColumns: "auto 1fr auto",
        }}
      >
        <div className="pt-[.125rem]">{icon}</div>
        <div className="text-sm font-bold text-left">{label}</div>
        <div className="pt-[.125rem] opacity-0 group-hover:opacity-100 transition-opacity">
          <ChevronRightIcon />
        </div>
      </div>
    </Button>
  );
};
