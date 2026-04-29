import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { CellProps, EditMode, GridColumn } from "../types";

type TextCellProps = CellProps<string | null> & {
  readonly?: boolean;
};

export function TextCell({
  value,
  editMode,
  onChange,
  stopEditing,
  readonly,
}: TextCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editValue, setEditValue] = useState("");
  const shouldCommitOnBlurRef = useRef(false);
  const [prevEditMode, setPrevEditMode] = useState<EditMode>(false);

  if (editMode && editMode !== prevEditMode) {
    setPrevEditMode(editMode);
    setEditValue(value ?? "");
    shouldCommitOnBlurRef.current = true;
  }
  if (!editMode && prevEditMode) {
    setPrevEditMode(false);
  }

  useLayoutEffect(() => {
    if (editMode) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editMode]);

  const commit = useCallback(() => {
    onChange(editValue || null);
  }, [editValue, onChange]);

  const handleBlur = useCallback(() => {
    if (!shouldCommitOnBlurRef.current) return;
    shouldCommitOnBlurRef.current = false;
    commit();
  }, [commit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        shouldCommitOnBlurRef.current = false;
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        shouldCommitOnBlurRef.current = false;
        stopEditing();
      } else if (
        editMode === "quick" &&
        ["ArrowUp", "ArrowDown", "Tab"].includes(e.key)
      ) {
        commit();
      }
    },
    [editMode, commit, stopEditing],
  );

  if (readonly) {
    return (
      <div className="w-full h-full flex items-center px-2 text-sm text-gray-500">
        {value ?? ""}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center">
      <input
        ref={inputRef}
        type="text"
        value={editMode ? editValue : (value ?? "")}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        readOnly={!editMode}
        className="w-full px-2 text-sm outline-none border-none ring-0 focus:outline-none focus:ring-0 bg-transparent truncate"
      />
    </div>
  );
}

export function textColumn(
  accessorKey: string,
  options: {
    header: string;
    size?: number;
    readonly?: boolean;
  },
): GridColumn {
  const { readonly } = options;

  const CellComponent = readonly
    ? (props: CellProps<string | null>) => <TextCell {...props} readonly />
    : TextCell;

  return {
    accessorKey,
    header: options.header,
    size: options.size,
    cellComponent: CellComponent,
    copyValue: (v) => (v as string | null) ?? "",
    pasteValue: (v) => v || null,
    deleteValue: null,
    ...(readonly ? { disabled: true, disableKeys: true } : {}),
  };
}
