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
import clsx from "clsx";
import {
  DialogContainer,
  DialogHeader,
  DialogButtons,
} from "src/components/dialog";
import { Button } from "../elements";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { InlineError } from "src/components/inline-error";
import { scenariosAtom } from "src/state/scenarios";

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
  const scenariosState = useAtomValue(scenariosAtom);

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

      const scenarios = Array.from(scenariosState.scenarios.values());
      const isDuplicate = scenarios.some(
        (s) => s.id !== scenarioId && s.name === trimmed,
      );

      if (isDuplicate) {
        return translate("scenarios.renameDialog.errorDuplicate");
      }

      return null;
    },
    [scenarioId, scenariosState.scenarios, translate],
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
          {translate("save")}
        </Button>
        <Button type="button" variant="default" onClick={onClose}>
          {translate("cancel")}
        </Button>
      </DialogButtons>
    </DialogContainer>
  );
};
