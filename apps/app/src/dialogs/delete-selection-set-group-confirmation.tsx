import { useAtomValue } from "jotai";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { useDeleteSelectionSetGroup } from "src/commands/selection-set-groups";
import {
  type SelectionSetGroupId,
  descendantGroupIds,
} from "src/lib/collections";
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
  const groups = useAtomValue(selectionSetGroupsAtom);
  const group = groups.find((candidate) => candidate.id === groupId);
  const removed = new Set([groupId, ...descendantGroupIds(groups, groupId)]);
  const setCount = useAtomValue(selectionSetsAtom).filter(
    (set) => set.groupId !== null && removed.has(set.groupId),
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
