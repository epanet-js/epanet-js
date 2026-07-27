import { BaseDialog, SimpleDialogActions } from "../components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { ErrorIcon } from "src/icons";
import { useShowReport } from "src/commands/show-report";

export const SimulationStorageErrorDialog = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const showReport = useShowReport();

  return (
    <BaseDialog
      title={translate("simulationStorageError")}
      size="sm"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          autoFocusSubmit={true}
          action={translate("understood")}
          onAction={onClose}
          secondary={{
            action: translate("viewReport"),
            onClick: () => showReport({ source: "resultDialog" }),
          }}
        />
      }
    >
      <div className="p-4 text-size-base text-default space-y-2">
        <p className="flex items-start gap-2">
          <div className="m-width-0 mt-0.5 text-red-500">
            <ErrorIcon />
          </div>
          {translate("simulationStorageErrorExplain")}
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>{translate("simulationStorageErrorPrivateMode")}</li>
          <li>{translate("simulationStorageErrorAntivirus")}</li>
          <li>{translate("simulationStorageErrorSupport")}</li>
        </ul>
      </div>
    </BaseDialog>
  );
};
