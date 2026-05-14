import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { EditMode } from "../types";

type UseEditableTextInputOptions<T> = {
  value: T;
  editMode: EditMode;
  onChange: (value: T) => void;
  stopEditing: () => void;
  /**
   * Convert the raw input string back into a typed value to commit.
   * Return `undefined` to skip the commit (e.g. invalid input).
   */
  parse: (raw: string) => T | undefined;
  /** Convert a committed value into its display string. */
  format: (value: T) => string;
  /**
   * Convert a value into the string shown in the input when edit mode begins.
   * Defaults to `format`. Useful when the editing representation differs from
   * the display representation (e.g. full-precision number while editing).
   */
  formatForEdit?: (value: T) => string;
  /** Keys that commit and let navigation through in `quick` edit mode. */
  quickNavKeys?: readonly string[];
};

const DEFAULT_QUICK_NAV_KEYS = ["ArrowUp", "ArrowDown", "Tab"] as const;

/**
 * Shared edit-mode plumbing for text-input-based cells (text, float, …).
 * Owns: input ref, edit-value state, error state, commit-on-blur tracking,
 * edit-mode transitions, focus/select on entry, selection clear on exit, the
 * committed-display flicker bridge, and the Enter/Escape/quick-nav keymap.
 *
 * Per-cell responsibility (passed in): `parse`, `format`, `formatForEdit`,
 * `quickNavKeys`, and `handleChange` (the cell builds its own change handler
 * since input normalization / async validation differ).
 */
export function useEditableTextInput<T>({
  value,
  editMode,
  onChange,
  stopEditing,
  parse,
  format,
  formatForEdit,
  quickNavKeys = DEFAULT_QUICK_NAV_KEYS,
}: UseEditableTextInputOptions<T>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editValue, setEditValue] = useState("");
  const [hasError, setHasError] = useState(false);
  const shouldCommitOnBlurRef = useRef(false);
  const [prevEditMode, setPrevEditMode] = useState<EditMode>(false);

  const initFormatter = formatForEdit ?? format;

  if (editMode && editMode !== prevEditMode) {
    setPrevEditMode(editMode);
    setEditValue(initFormatter(value));
    setHasError(false);
    shouldCommitOnBlurRef.current = true;
  }
  if (!editMode && prevEditMode) {
    setPrevEditMode(false);
    setHasError(false);
  }

  useLayoutEffect(
    function syncInputFocusAndSelection() {
      const input = inputRef.current;
      if (!input) return;
      if (editMode) {
        input.focus();
        input.select();
      } else {
        // Collapse any leftover text selection when exiting edit mode.
        input.setSelectionRange(0, 0);
      }
    },
    [editMode],
  );

  // Bridges the gap between an in-cell commit and the parent re-rendering
  // with the new prop value. Without this, the cell flickers back to the
  // previous value when edit mode exits but `value` hasn't propagated yet
  // (e.g. async row derivation upstream).
  const [committedDisplay, setCommittedDisplay] = useState<string | null>(null);
  const committedValueRef = useRef<T | undefined>(undefined);

  useEffect(
    function preventOldValueFlickerOnCommit() {
      if (committedDisplay === null) return;
      if (value === committedValueRef.current) {
        setCommittedDisplay(null);
        return;
      }
      // Failsafe: if the change is rejected upstream and `value` never
      // catches up, clear after a short delay so the cell doesn't get
      // stuck showing the committed string.
      const id = setTimeout(() => setCommittedDisplay(null), 100);
      return () => clearTimeout(id);
    },
    [value, committedDisplay],
  );

  if (editMode && committedDisplay !== null) {
    setCommittedDisplay(null);
  }

  const commit = useCallback(() => {
    const newValue = parse(editValue);
    if (newValue === undefined) return;
    committedValueRef.current = newValue;
    setCommittedDisplay(format(newValue));
    onChange(newValue);
  }, [editValue, parse, format, onChange]);

  const handleBlur = useCallback(() => {
    if (!shouldCommitOnBlurRef.current) return;
    shouldCommitOnBlurRef.current = false;
    commit();
  }, [commit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // The input keeps focus when the cell isn't in edit mode (it's just
      // readonly), so onKeyDown still fires. Bail out so keys bubble to the
      // grid for selection/navigation — otherwise commit() would run with
      // an empty editValue and wipe the cell.
      if (!editMode) return;
      if (e.key === "Enter") {
        e.preventDefault();
        shouldCommitOnBlurRef.current = false;
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        shouldCommitOnBlurRef.current = false;
        stopEditing();
      } else if (editMode === "quick" && quickNavKeys.includes(e.key)) {
        commit();
      }
    },
    [editMode, commit, stopEditing, quickNavKeys],
  );

  return {
    inputRef,
    editValue,
    setEditValue,
    hasError,
    setHasError,
    committedDisplay,
    handleBlur,
    handleKeyDown,
  };
}
