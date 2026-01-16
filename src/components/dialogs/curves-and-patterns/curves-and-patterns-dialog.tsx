import { DialogContainer, DialogHeader, useDialogState } from "../../dialog";
import { useTranslate } from "src/hooks/use-translate";
import { Button } from "src/components/elements";

export const CurvesAndPatternsDialog = () => {
  const translate = useTranslate();
  const { closeDialog } = useDialogState();

  return (
    <DialogContainer size="lg">
      <DialogHeader title={translate("curvesAndPatterns")} />
      <div className="flex-1 flex items-center justify-center text-gray-500">
        {translate("curvesAndPatternsEmpty")}
      </div>
      <div className="pt-6 flex flex-row-reverse gap-x-3">
        <Button type="button" variant="primary" disabled>
          {translate("save")}
        </Button>
        <Button type="button" onClick={closeDialog}>
          {translate("cancel")}
        </Button>
      </div>
    </DialogContainer>
  );
};
