import {
  useCallback,
  useEffect,
  useRef,
  useState,
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
} from "react";
import { useAtomValue } from "jotai";
import { Formik, Form, useField } from "formik";
import clsx from "clsx";
import {
  DialogContainer,
  DialogHeader,
  DialogButtons,
  BaseModal,
  SimpleDialogActionsNew,
} from "src/components/dialog";
import { Button } from "../elements";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
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
  const isModalsOn = useFeatureFlag("FLAG_MODALS");
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const worktree = useAtomValue(worktreeAtom);

  const [newName, setNewName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
        .map((id) => worktree.snapshots.get(id))
        .filter(Boolean);
      const isDuplicate = scenarios.some(
        (s) => s!.id !== scenarioId && s!.name === trimmed,
      );

      if (isDuplicate) {
        return translate("scenarios.renameDialog.errorDuplicate");
      }

      return null;
    },
    [scenarioId, worktree.scenarios, worktree.snapshots, translate],
  );

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewName(value);
    setError(validateName(value));
  };

  const handleSubmit = (e?: FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    const trimmed = newName.trim();
    const validationError = validateName(trimmed);

    if (validationError) {
      setError(validationError);
      return;
    }

    userTracking.capture({
      name: "scenario.renamed",
      scenarioId,
      oldName: currentName,
      newName: trimmed,
    });

    onConfirm(scenarioId, trimmed);
    onClose();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  useEffect(() => {
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 0);
  }, []);

  if (isModalsOn) {
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
          <BaseModal
            title={translate("scenarios.renameDialog.title")}
            size="xs"
            isOpen={true}
            onClose={onClose}
            footer={
              <SimpleDialogActionsNew
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
          </BaseModal>
        )}
      </Formik>
    );
  }

  return (
    <DialogContainer size="xs">
      <DialogHeader title={translate("scenarios.renameDialog.title")} />

      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label className="block text-sm font-medium mb-1">
            {translate("scenarios.renameDialog.label")}
          </label>
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            className={clsx(
              "w-full px-3 py-2 border rounded text-sm",
              error
                ? "border-orange-500 dark:border-orange-700 focus-visible:ring-orange-500"
                : "border-gray-300 focus-visible:ring-purple-500",
            )}
            placeholder={translate("scenarios.renameDialog.placeholder")}
          />
          <span className="py-2">
            {error && <InlineError>{error}</InlineError>}
          </span>
        </div>
      </form>

      <DialogButtons>
        <Button
          type="button"
          variant="primary"
          onClick={() => handleSubmit()}
          disabled={!!error}
        >
          {translate("dialog.save")}
        </Button>
        <Button type="button" variant="default" onClick={onClose}>
          {translate("dialog.cancel")}
        </Button>
      </DialogButtons>
    </DialogContainer>
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
