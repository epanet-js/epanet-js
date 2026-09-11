import { useAtomValue } from "jotai";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { willRequireLsx } from "src/simulation";

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
  const isScriptingOn = useFeatureFlag("FLAG_REMOTE_SETPOINT_PRV");
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const showLsxWarning = isScriptingOn && willRequireLsx(hydraulicModel);

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
        {showLsxWarning && <LsxRequiredWarning />}
      </div>
    </BaseDialog>
  );
};

export const LsxRequiredWarning = () => {
  const translate = useTranslate();

  return (
    <div className="mt-4 p-3 rounded-md space-y-1 bg-yellow-50 border border-yellow-200">
      <p className="text-size-base font-medium text-yellow-800">
        {translate("alertExportInpLsxTitle")}
      </p>
      <p className="text-size-base text-yellow-800">
        {translate("alertExportInpLsxTextBefore")}{" "}
        <a
          href="https://github.com/epanet-js/EPANET-LSX"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          {translate("alertExportInpLsxLinkLabel")}
        </a>
        {translate("alertExportInpLsxTextAfter")}
      </p>
    </div>
  );
};
