import type { ConvertResult } from "src/lib/convert/utils";
import { DialogHeader } from "src/components/dialog";
import { translate } from "src/infra/i18n";
import { CrossCircledIcon } from "@radix-ui/react-icons";

import { AckDialogAction } from "./simple_dialog_actions";
import { OpenErrorDialogState } from "src/state/dialog_state";

export type OnNext = (arg0: ConvertResult | null) => void;

export function OpenErrorDialog({
  modal,
  onClose,
}: {
  modal: OpenErrorDialogState;
  onClose: () => void;
}) {
  const { file } = modal;

  return (
    <>
      <DialogHeader
        title={translate("error")}
        titleIcon={CrossCircledIcon}
        variant="danger"
      />
      <div className="text-sm">
        <p>
          {translate("failedToProcessFile")}: {file.name}
        </p>
      </div>
      <AckDialogAction label={translate("understood")} onAck={onClose} />
    </>
  );
}
