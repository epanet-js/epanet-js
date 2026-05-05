import clsx from "clsx";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { CellProps, EditMode, GridColumn } from "../types";

const VALIDATION_DEBOUNCE_MS = 150;

type TextCellProps = CellProps<string | null> & {
  readonly?: boolean;
  validate?: (value: string, rowIndex: number) => boolean;
};

export function TextCell({
  value,
  rowIndex,
  editMode,
  onChange,
  stopEditing,
  readonly,
  validate,
}: TextCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editValue, setEditValue] = useState("");
  const [hasError, setHasError] = useState(false);
  const shouldCommitOnBlurRef = useRef(false);
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [prevEditMode, setPrevEditMode] = useState<EditMode>(false);

  if (editMode && editMode !== prevEditMode) {
    setPrevEditMode(editMode);
    setEditValue(value ?? "");
    setHasError(false);
    shouldCommitOnBlurRef.current = true;
  }
  if (!editMode && prevEditMode) {
    setPrevEditMode(false);
    setHasError(false);
  }

  useLayoutEffect(() => {
    if (editMode) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editMode]);

  useEffect(() => {
    return () => {
      if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
    };
  }, []);

  const isValid = useCallback(
    (v: string) => !validate || v === "" || validate(v, rowIndex),
    [validate, rowIndex],
  );

  const commit = useCallback(() => {
    if (!isValid(editValue)) return;
    onChange(editValue || null);
  }, [editValue, isValid, onChange]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setEditValue(newValue);

      if (validate) {
        if (validationTimerRef.current)
          clearTimeout(validationTimerRef.current);
        validationTimerRef.current = setTimeout(() => {
          setHasError(newValue !== "" && !validate(newValue, rowIndex));
        }, VALIDATION_DEBOUNCE_MS);
      }
    },
    [validate, rowIndex],
  );

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
      <div className="w-full h-full flex items-center px-2 text-sm text-gray-500 bg-gray-50">
        {value ?? ""}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "w-full h-full flex items-center",
        hasError &&
          editMode &&
          "z-[2] bg-orange-100 dark:bg-orange-900/30 ring-1 ring-orange-500 dark:ring-orange-700",
      )}
    >
      <input
        ref={inputRef}
        type="text"
        value={editMode ? editValue : (value ?? "")}
        onChange={handleChange}
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
    isReadOnly?: boolean;
    validate?: (value: string, rowIndex: number) => boolean;
  },
): GridColumn {
  const { isReadOnly, validate } = options;

  const CellComponent =
    isReadOnly || validate
      ? (props: CellProps<string | null>) => (
          <TextCell {...props} readonly={isReadOnly} validate={validate} />
        )
      : TextCell;

  return {
    accessorKey,
    header: options.header,
    size: options.size,
    cellComponent: CellComponent,
    copyValue: (v) => (v as string | null) ?? "",
    pasteValue: (v) => v || null,
    deleteValue: null,
    ...(isReadOnly ? { disabled: true, disableKeys: true } : {}),
  };
}
