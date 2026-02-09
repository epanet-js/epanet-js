import { useEffect, useRef, useState, KeyboardEvent, FormEvent } from "react";
import {
  DialogContainer,
  DialogHeader,
  DialogButtons,
} from "src/components/dialog";
import { Button } from "../elements";
import { CommitIcon } from "src/icons";

export const SaveRevisionDialog = ({
  onConfirm,
  onClose,
}: {
  onConfirm: (message: string) => void;
  onClose: () => void;
}) => {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
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
      inputRef.current?.focus();
    }, 0);
  }, []);

  return (
    <DialogContainer size="sm">
      <DialogHeader title="Save changes" titleIcon={CommitIcon} />

      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label className="block text-sm font-medium mb-1">
            Revision name
          </label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus-visible:ring-purple-500"
            placeholder="e.g. Increased pump capacity"
          />
        </div>
      </form>

      <DialogButtons>
        <Button
          type="button"
          variant="primary"
          onClick={() => handleSubmit()}
          disabled={!name.trim()}
        >
          Save
        </Button>
        <Button type="button" variant="default" onClick={onClose}>
          Cancel
        </Button>
      </DialogButtons>
    </DialogContainer>
  );
};
