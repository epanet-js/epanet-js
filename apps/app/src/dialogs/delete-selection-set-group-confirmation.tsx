import { useAtomValue } from "jotai";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { useDeleteSelectionSetGroup } from "src/commands/selection-set-groups";
import type { SelectionSetGroupId } from "src/lib/collections";
import {
  selectionSetGroupsAtom,
  selectionSetsAtom,
} from "src/state/collections";

export const DeleteSelectionSetGroupConfirmationDialog = ({
  groupId,
  onClose,
}: {
  groupId: SelectionSetGroupId;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const group = useAtomValue(selectionSetGroupsAtom).find(
    (candidate) => candidate.id === groupId,
  );
  const setCount = useAtomValue(selectionSetsAtom).filter(
    (set) => set.groupId === groupId,
  ).length;
  const deleteSelectionSetGroup = useDeleteSelectionSetGroup();

  if (!group) return null;

  const handleConfirm = () => {
    onClose();
    deleteSelectionSetGroup({ groupId, source: "panel" });
  };

  return (
    <BaseDialog
      title={translate("collections.groups.delete")}
      size="sm"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("collections.groups.delete")}
          onAction={handleConfirm}
          actionVariant="danger"
          secondary={{
            action: translate("dialog.cancel"),
            onClick: onClose,
          }}
        />
      }
    >
      <div className="p-4 text-size-base text-default">
        <p>
          {translate(
            "collections.groups.deleteConfirmation",
            setCount,
            group.label,
          )}
        </p>
      </div>
    </BaseDialog>
  );
};
