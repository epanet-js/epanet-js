import { DialogContainer, DialogHeader, useDialogState } from "../../dialog";
import { useTranslate } from "src/hooks/use-translate";
import { Button } from "src/components/elements";

export const PumpCurvesDialog = () => {
  const translate = useTranslate();
  const { closeDialog } = useDialogState();

  return (
    <DialogContainer size="lg" height="lg" onClose={closeDialog}>
      <DialogHeader title={translate("pumpLibrary")} />
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">Pump Curves Dialog - Coming Soon</p>
      </div>
      <div className="pt-6 flex flex-row-reverse gap-x-3">
        <Button type="button" onClick={closeDialog}>
          {translate("close")}
        </Button>
      </div>
    </DialogContainer>
  );
};
