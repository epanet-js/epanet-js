import {
  ChangeEventHandler,
  FocusEventHandler,
  KeyboardEventHandler,
  useRef,
  useState,
  useEffect,
} from "react";
import { parseLocaleNumber, reformatWithoutGroups } from "src/infra/i18n";
import { normalizeNumericInput } from "./numeric-input-utils";
import clsx from "clsx";

type StyleOptions = {
  textSize?: "xs" | "sm" | "md";
  padding?: "md" | "sm";
  border?: "sm" | "none";
  ghostBorder?: boolean;
  variant?: "default" | "warning";
  disabled?: boolean;
};

export const NumericField = ({
  label,
  displayValue,
  onChangeValue,
  positiveOnly = false,
  readOnly = false,
  disabled = false,
  isNullable = true,
  placeholder,
  styleOptions = {},
  tabIndex = 1,
  validate,
}: {
  label: string;
  displayValue: string;
  onChangeValue?: (newValue: number, isEmpty: boolean) => void;
  isNullable?: boolean;
  /** @deprecated Legacy fallback; ignored when `validate` is provided. To be
   * removed in the null-values feature-flag cleanup. */
  positiveOnly?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  styleOptions?: Partial<StyleOptions>;
  tabIndex?: number;
  validate?: (value: number) => boolean;
}) => {
  // `validate` is the single source of truth when present; `positiveOnly` is a
  // legacy fallback only used when there is no validator. The informational
  // commit (invalid values warn but still commit) is driven by `isNullable`.
  const enforcePositiveOnly = positiveOnly && validate === undefined;

  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(displayValue);
  const [hasError, setError] = useState(false);
  // hasError drives the warning styling; isBlocked gates the commit. For
  // nullable fields a failed domain validation (e.g. not > 0) is informational
  // only — the value still commits and enforcement moves to the
  // pre-simulation check. A genuinely invalid number always blocks.
  const [isBlocked, setBlocked] = useState(false);
  const [isDirty, setDirty] = useState(false);

  useEffect(() => {
    if (!isDirty && document.activeElement !== inputRef.current) {
      setInputValue(displayValue);
    }
  }, [displayValue, isDirty]);

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Escape") {
      resetInput();
      return;
    }
    if (e.key === "Enter" && !isBlocked) {
      e.preventDefault();
      handleCommitLastChange();
      return;
    }
    if (e.key === "Enter" && isBlocked) {
      e.preventDefault();
      resetInput();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "y")) {
      e.preventDefault();
    }
  };

  const resetInput = () => {
    setInputValue(displayValue);
    setDirty(false);
    setError(false);
    setBlocked(false);
    blurInput();
  };

  const handleBlur = () => {
    if (isDirty && !isBlocked) {
      handleCommitLastChange();
    } else {
      resetInput();
    }
  };

  const handleFocus: FocusEventHandler<HTMLInputElement> = (e) => {
    e.preventDefault();
    setInputValue(reformatWithoutGroups(displayValue));
    setTimeout(() => inputRef.current && inputRef.current.select(), 0);
  };

  const handleCommitLastChange = () => {
    const numericValue = parseLocaleNumber(inputValue);
    const isEmpty = inputValue.trim() === "";
    setInputValue(isNullable && isEmpty ? "" : String(numericValue));
    onChangeValue && onChangeValue(numericValue, isEmpty);

    setDirty(false);
    setError(false);
    setBlocked(false);
    blurInput();
  };

  const blurInput = () => {
    if (inputRef.current !== document.activeElement) return;

    setTimeout(() => inputRef.current && inputRef.current.blur(), 0);
  };

  const handleInputChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const rawValue = e.target.value;
    const newInputValue = normalizeNumericInput(rawValue, {
      positiveOnly: enforcePositiveOnly,
    });
    if (newInputValue === inputValue) return;
    if (rawValue.length > 0 && newInputValue.length === 0) return;
    setInputValue(newInputValue);
    const isEmpty = newInputValue.trim() === "";
    const numericValue = parseLocaleNumber(newInputValue);
    const isInvalidNumber = isEmpty ? !isNullable : isNaN(numericValue);
    const failsValidation =
      !isEmpty &&
      !isInvalidNumber &&
      validate !== undefined &&
      !validate(numericValue);
    setError(isInvalidNumber || failsValidation);
    // A failed domain validation only blocks the commit on non-nullable fields;
    // for nullable fields it is a warning and the value still commits.
    setBlocked(isInvalidNumber || (failsValidation && !isNullable));
    setDirty(true);
  };

  if (hasError && inputRef.current) {
    inputRef.current.className = styledInput({
      ...styleOptions,
      variant: "warning",
      disabled,
    });
  }
  if (!hasError && inputRef.current) {
    inputRef.current.className = styledInput({ ...styleOptions, disabled });
  }

  return (
    <input
      onChange={handleInputChange}
      onKeyDown={handleKeyDown}
      spellCheck="false"
      type="text"
      aria-label={`Value for: ${label}`}
      readOnly={readOnly}
      disabled={disabled}
      placeholder={placeholder}
      onBlur={handleBlur}
      ref={inputRef}
      value={inputValue}
      onFocus={handleFocus}
      tabIndex={tabIndex}
      className={styledInput({ ...styleOptions, disabled })}
    />
  );
};

function styledInput({
  padding = "md",
  border = "sm",
  variant = "default",
  textSize = "sm",
  ghostBorder = false,
  disabled = false,
}: StyleOptions = {}) {
  return clsx(
    disabled
      ? "text-subtle cursor-not-allowed bg-base-disabled"
      : "text-default",
    {
      "p-1": padding === "sm",
      "p-2": padding === "md",
    },
    {
      "border-none": border === "none",
      "border focus-visible:border-transparent": border === "sm",
    },
    ghostBorder && variant !== "warning"
      ? "border-transparent bg-transparent"
      : variant === "warning"
        ? "border-orange-500 dark:border-orange-700"
        : "border-strong hover:border",
    !disabled && !ghostBorder && variant !== "warning" && "bg-base",
    !disabled && {
      "focus-visible:bg-purple-300/10 dark:focus-visible:bg-purple-700/40 focus-visible:ring-accent":
        variant === "default",
      "focus-visible:bg-orange-300/10 dark:focus-visible:bg-orange-700/40 dark:focus-visible:ring-orange-700 focus-visible:ring-orange-500":
        variant === "warning",
    },
    {
      "text-size-small": textSize === "xs",
      "text-size-base": textSize === "sm",
      "text-md": textSize === "md",
    },

    "rounded-xs block tabular-nums overflow-hidden whitespace-nowrap text-ellipsis focus-visible:ring-inset w-full placeholder:italic placeholder:text-subtle",
  );
}
