import type { ConvertResult } from "src/types/export";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { useShowWelcome } from "src/commands/show-welcome";
import { useAvailableConverters } from "src/hooks/use-available-converters";
import { describeFileTypes } from "src/lib/describe-file-types";
import { projectExtension } from "src/commands/save-project";
import { inpExtension } from "src/commands/import-inp";
export type OnNext = (arg0: ConvertResult | null) => void;

export function InvalidFilesErrorDialog({ onClose }: { onClose: () => void }) {
  const translate = useTranslate();
  const showWelcome = useShowWelcome();
  const converters = useAvailableConverters();

  const supportedFileTypes = describeFileTypes([
    `Project (${projectExtension})`,
    `EPANET INP (${inpExtension})`,
    ...converters.map(
      ({ converter }) =>
        `${converter.name} (${converter.extensions.join(", ")})`,
    ),
  ]);

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
      <div className="p-4 text-size-base">
        <p>{translate("failedToOpenModelDetail", supportedFileTypes)}</p>
      </div>
    </BaseDialog>
  );
}
