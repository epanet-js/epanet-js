import { AppLoadFailedDialogState } from "src/state/dialog";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";

export const AppLoadFailedDialog = ({
  modal,
}: {
  modal: AppLoadFailedDialogState;
}) => {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <BaseDialog
      title="There was a problem loading the app"
      size="sm"
      isOpen={true}
      onClose={handleReload}
      preventClose
      footer={<SimpleDialogActions action="Reload" onAction={handleReload} />}
    >
      <div className="p-4 space-y-3">
        <p className="text-size-base text-default">
          A required component failed to download. This may be due to a network
          issue or a firewall blocking access. Please check your connection and
          reload the page.
        </p>
        {modal.errorMessage && (
          <details className="text-size-small">
            <summary className="cursor-pointer text-subtle hover:text-default">
              Show details
            </summary>
            <pre className="mt-2 whitespace-pre-wrap wrap-break-word font-mono text-default bg-panel border rounded-sm p-2 max-h-40 overflow-auto">
              {modal.errorMessage}
            </pre>
          </details>
        )}
      </div>
    </BaseDialog>
  );
};
