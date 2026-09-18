import { useAtomValue } from "jotai";
import { useMemo, useState } from "react";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { Button } from "src/components/elements";
import { ChevronDownIcon, ChevronRightIcon } from "src/icons";
import type { HydraulicModel } from "src/hydraulic-model";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { remoteSetpointValves, willRequireLsx } from "src/simulation";

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
        {showLsxWarning && (
          <LsxRequiredWarning hydraulicModel={hydraulicModel} />
        )}
        <p className="pb-2">{translate("alertExportInpDetail")}</p>
        <p className="pb-2">{translate("alertExportInpLabels")}</p>
        <p>{translate("alertExportInpRecommendation")}</p>
      </div>
    </BaseDialog>
  );
};

export const LsxRequiredWarning = ({
  hydraulicModel,
}: {
  hydraulicModel: HydraulicModel;
}) => {
  const translate = useTranslate();
  const [isExpanded, setExpanded] = useState(false);
  const valveLabels = useMemo(
    () => remoteSetpointValves(hydraulicModel),
    [hydraulicModel],
  );

  return (
    <div className="mb-4 p-3 rounded-md space-y-1 bg-yellow-50 border border-yellow-200">
      <p className="text-size-base font-medium text-yellow-800">
        {translate("alertExportInpLsxTitle")}
      </p>
      <p className="text-size-base">
        {translate("alertExportInpLsxIncompatible")}
      </p>
      <p className="text-size-base">
        {translate("alertExportInpLsxDownloadBefore")}{" "}
        <a
          href="https://github.com/epanet-js/EPANET-LSX"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          {translate("alertExportInpLsxLinkLabel")}
        </a>
        {translate("alertExportInpLsxDownloadAfter")}
      </p>
      <Button
        variant="quiet"
        onClick={(e) => {
          e.preventDefault();
          setExpanded(!isExpanded);
        }}
        className="cursor-pointer text-size-base inline-flex items-center"
      >
        {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
        {translate("alertExportInpLsxKnowMore")}
      </Button>
      {isExpanded && (
        <ul className="list-disc pl-8 text-size-base">
          <li>
            {translate("alertExportInpLsxRemoteSetpointPrvs")} (
            {summarizeLabels(valveLabels)})
          </li>
        </ul>
      )}
    </div>
  );
};

const maxLabelsShown = 3;

const summarizeLabels = (labels: string[]): string =>
  labels.length > maxLabelsShown
    ? `${labels.slice(0, maxLabelsShown).join(", ")}, ...`
    : labels.join(", ");
