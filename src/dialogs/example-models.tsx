import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { useOpenInpFromUrl } from "src/commands/open-inp-from-url";
import { BaseDialog, useDialogState } from "src/components/dialog";
import { DEMO_NETWORKS } from "src/demo/demo-networks";

type DemoModel = (typeof DEMO_NETWORKS)[number];

export const ExampleModelsDialog = () => {
  const translate = useTranslate();
  const { closeDialog } = useDialogState();

  return (
    <BaseDialog
      title={translate("exampleModels")}
      size="md"
      isOpen={true}
      onClose={closeDialog}
    >
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {DEMO_NETWORKS.map((demo) => (
          <ExampleCard key={demo.name} demo={demo} />
        ))}
      </div>
    </BaseDialog>
  );
};

const descriptionKeyByName: Record<string, string> = {
  Drumchapel: "demoUKStyleDescription",
  Waterdown: "demoUSStyleDescription",
};

const ExampleCard = ({ demo }: { demo: DemoModel }) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const { openInpFromUrl } = useOpenInpFromUrl();

  const description = translate(descriptionKeyByName[demo.name]);

  const handleClick = () => {
    userTracking.capture({
      name: "exampleModel.clicked",
      modelName: demo.name,
    });
    void openInpFromUrl(demo.url);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-left flex flex-col rounded-lg border shadow-sm cursor-pointer hover:bg-gray-50 overflow-hidden min-w-0 focus:outline-none focus:ring-2 focus:ring-purple-300"
    >
      <div
        className="relative bg-gray-100 shrink-0 overflow-hidden"
        style={{ aspectRatio: "5/4" }}
      >
        <img
          src={demo.thumbnailUrl}
          alt={demo.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-3 flex flex-col gap-1 overflow-hidden">
        <span
          className="text-sm font-medium text-gray-800 truncate"
          title={demo.name}
        >
          {demo.name}
        </span>
        <span className="text-xs text-gray-500 line-clamp-2">
          {description}
        </span>
      </div>
    </button>
  );
};
