import { useEffect, useRef, useState, KeyboardEvent, FormEvent } from "react";
import {
  DialogContainer,
  DialogHeader,
  DialogButtons,
} from "src/components/dialog";
import { Button } from "../elements";
import { PinIcon } from "src/icons";

export const PromoteVersionDialog = ({
  versionId,
  onConfirm,
  onClose,
}: {
  versionId: string;
  onConfirm: (versionId: string, name: string) => void;
  onClose: () => void;
}) => {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(versionId, trimmed);
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
      <DialogHeader title="Pin as independent branch" titleIcon={PinIcon} />

      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label className="block text-sm font-medium mb-1">Branch name</label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus-visible:ring-purple-500"
            placeholder="e.g. Baseline v2"
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
          Pin
        </Button>
        <Button type="button" variant="default" onClick={onClose}>
          Cancel
        </Button>
      </DialogButtons>
    </DialogContainer>
  );
};
