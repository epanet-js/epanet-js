import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { usePermissions } from "src/hooks/use-permissions";

export const ModelAttributesValidationDialog = ({
  issueCount,
  onFixFirst,
  onRunAnyway,
  onClose,
}: {
  issueCount: number;
  onFixFirst: () => void;
  onRunAnyway: () => void;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const { canValidateModelAttributes } = usePermissions();

  const handleFixFirst = () => {
    onClose();
    onFixFirst();
  };

  const handleRunAnyway = () => {
    onClose();
    onRunAnyway();
  };

  return (
    <BaseDialog
      title={translate("modelAttributesValidation.dialog.title")}
      size="sm"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("modelAttributesValidation.dialog.fixFirst")}
          onAction={handleFixFirst}
          secondary={{
            action: translate("modelAttributesValidation.dialog.runAnyway"),
            onClick: handleRunAnyway,
          }}
        />
      }
    >
      <div className="p-4 text-size-base flex flex-col gap-2">
        <p>
          {translate(
            "modelAttributesValidation.dialog.body",
            String(issueCount),
          )}
        </p>
        {!canValidateModelAttributes && (
          <p>{translate("modelAttributesValidation.dialog.upgradeHint")}</p>
        )}
      </div>
    </BaseDialog>
  );
};
