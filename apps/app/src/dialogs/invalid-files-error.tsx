import type { ConvertResult } from "src/types/export";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { useShowWelcome } from "src/commands/show-welcome";
export type OnNext = (arg0: ConvertResult | null) => void;

export function InvalidFilesErrorDialog({ onClose }: { onClose: () => void }) {
  const translate = useTranslate();
  const showWelcome = useShowWelcome();

  return (
    <BaseDialog
      title={translate("failedToOpenModel")}
      size="xs"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("understood")}
          onAction={onClose}
          secondary={{
            action: translate("seeDemoNetworks"),
            onClick: () => showWelcome({ source: "invalidFilesError" }),
          }}
        />
      }
    >
      <div className="p-4 text-sm">
        <p>{translate("failedToOpenModelDetail")}</p>
      </div>
    </BaseDialog>
  );
}
