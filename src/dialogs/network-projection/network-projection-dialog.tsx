import {
  BaseDialog,
  SimpleDialogActions,
  useDialogState,
} from "src/components/dialog";
import { MapPreview } from "./map-preview";

export const NetworkProjectionDialog = () => {
  const { closeDialog } = useDialogState();

  return (
    <BaseDialog
      title="Network projection"
      size="xxl"
      height="xxl"
      isOpen={true}
      onClose={closeDialog}
      footer={
        <SimpleDialogActions
          action="Add basemap"
          onAction={closeDialog}
          secondary={{ action: "Load without basemap", onClick: closeDialog }}
        />
      }
    >
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-shrink-0 w-[300px] border-r border-gray-200 p-4" />
        <MapPreview />
      </div>
    </BaseDialog>
  );
};
