import { useCallback, useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { Formik, Form, useField } from "formik";
import clsx from "clsx";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { InlineError } from "src/components/inline-error";
import { worktreeAtom } from "src/state/scenarios";

export const RenameScenarioDialog = ({
  scenarioId,
  currentName,
  onConfirm,
  onClose,
}: {
  scenarioId: string;
  currentName: string;
  onConfirm: (scenarioId: string, newName: string) => void;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const worktree = useAtomValue(worktreeAtom);

  const validateName = useCallback(
    (name: string): string | null => {
      const trimmed = name.trim();

      if (!trimmed) {
        return translate("scenarios.renameDialog.errorEmpty");
      }

      if (trimmed.toLowerCase() === "main") {
        return translate("scenarios.renameDialog.errorReserved");
      }

      const scenarios = worktree.scenarios
        .map((id) => worktree.branches.get(id))
        .filter(Boolean);
      const isDuplicate = scenarios.some(
        (s) => s!.id !== scenarioId && s!.name === trimmed,
      );

      if (isDuplicate) {
        return translate("scenarios.renameDialog.errorDuplicate");
      }

      return null;
    },
    [scenarioId, worktree.scenarios, worktree.branches, translate],
  );

  return (
    <Formik
      initialValues={{ name: currentName }}
      onSubmit={({ name }: { name: string }) => {
        userTracking.capture({
          name: "scenario.renamed",
          scenarioId,
          oldName: currentName,
          newName: name.trim(),
        });
        onConfirm(scenarioId, name.trim());
        onClose();
      }}
    >
      {({ submitForm, isSubmitting }) => (
        <BaseDialog
          title={translate("scenarios.renameDialog.title")}
          size="xs"
          isOpen={true}
          onClose={onClose}
          footer={
            <SimpleDialogActions
              action={translate("dialog.save")}
              onAction={submitForm}
              isSubmitting={isSubmitting}
              secondary={{
                action: translate("dialog.cancel"),
                onClick: onClose,
              }}
            />
          }
        >
          <Form>
            <div className="p-4">
              <RenameField
                validateName={validateName}
                placeholder={translate("scenarios.renameDialog.placeholder")}
                label={translate("scenarios.renameDialog.label")}
              />
            </div>
          </Form>
        </BaseDialog>
      )}
    </Formik>
  );
};

function RenameField({
  validateName,
  placeholder,
  label,
}: {
  validateName: (name: string) => string | null;
  placeholder: string;
  label: string;
}) {
  const [field, meta] = useField({
    name: "name",
    validate: (value) => validateName(value) ?? undefined,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 0);
  }, []);

  return (
    <div className="space-y-2">
      <label className="block text-sm text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <input
        {...field}
        ref={inputRef}
        type="text"
        className={clsx(
          "w-full px-3 py-2 border rounded text-sm",
          meta.error && meta.touched
            ? "border-orange-500 dark:border-orange-700 focus-visible:ring-orange-500"
            : "border-gray-300 focus-visible:ring-purple-500",
        )}
        placeholder={placeholder}
      />
      <span className="py-2">
        {meta.error && meta.touched && <InlineError>{meta.error}</InlineError>}
      </span>
    </div>
  );
}
