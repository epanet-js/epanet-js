"use client";
import { BaseDialog, AckDialogAction } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";

export const ChartBuilderNoSimulationDialog = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const translate = useTranslate();

  return (
    <BaseDialog
      title={translate("chartBuilder.noSimulation.title")}
      size="sm"
      isOpen={true}
      onClose={onClose}
      footer={
        <AckDialogAction onAck={onClose} label={translate("understood")} />
      }
    >
      <div className="p-4 text-sm">
        <p>{translate("chartBuilder.noSimulation.message")}</p>
      </div>
    </BaseDialog>
  );
};
