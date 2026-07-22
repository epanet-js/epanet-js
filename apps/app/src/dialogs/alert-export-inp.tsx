import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const AlertExportInpDialog = ({
  onSaveProject,
  onExportAnyway,
  onClose,
}: {
  onSaveProject: () => void;
  onExportAnyway: () => void;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const isExportLabelsOn = useFeatureFlag("FLAG_EXPORT_LABELS");

  return (
    <BaseDialog
      title={translate("alertExportInp")}
      size="md"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("exportToInp")}
          onAction={() => {
            onClose();
            onExportAnyway();
          }}
          secondary={{
            action: translate("saveAsProject"),
            onClick: () => {
              onClose();
              onSaveProject();
            },
          }}
        />
      }
    >
      <div className="p-4 text-size-base text-default">
        <p className="pb-2">{translate("alertExportInpDetail")}</p>
        {isExportLabelsOn && (
          <p className="pb-2">{translate("alertExportInpLabels")}</p>
        )}
        <p>{translate("alertExportInpRecommendation")}</p>
      </div>
    </BaseDialog>
  );
};
