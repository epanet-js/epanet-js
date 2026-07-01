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

// Default validator when a caller doesn't provide one: the value just has to be
// a number, so a non-numeric entry (parsed as NaN) fails it.
const isNumber = (value: number) => !Number.isNaN(value);

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
  readOnly = false,
  disabled = false,
  isRequired = false,
  commitInvalidValues = false,
  placeholder,
  styleOptions = {},
  tabIndex = 1,
  validate,
}: {
  label: string;
  displayValue: string;
  onChangeValue?: (newValue: number, isEmpty: boolean) => void;
  isRequired?: boolean;
  commitInvalidValues?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  styleOptions?: Partial<StyleOptions>;
  tabIndex?: number;
  validate?: (value: number) => boolean;
}) => {
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
      const { hasError, isBlocked } = validationStateFor(displayValue, {
        isRequired,
        commitInvalidValues,
        validate,
      });
      setError(hasError);
      setBlocked(isBlocked);
    }
  }, [displayValue, isDirty, isRequired, commitInvalidValues, validate]);

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
    setInputValue(isEmpty ? "" : String(numericValue));
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
    const newInputValue = normalizeNumericInput(rawValue);
    if (newInputValue === inputValue) return;
    if (rawValue.length > 0 && newInputValue.length === 0) return;
    setInputValue(newInputValue);
    const { hasError, isBlocked } = validationStateFor(newInputValue, {
      isRequired,
      commitInvalidValues,
      validate,
    });
    setError(hasError);
    setBlocked(isBlocked);
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

// Warning + blocking state for a given input string, from three orthogonal
// inputs — there is no separate "clearable" concept:
//   - isRequired → an empty value is invalid (e.g. an unmapped roughness, or
//                  reservoir head which is required but has no range validator)
//   - validate   → check for non-empty values; defaults to "is a number"
//   - commitInvalidValues → commit invalid values (out-of-range or empty-but-
//                  required) with a warning instead of reverting; a non-numeric
//                  value always reverts
//
// "Can the user commit empty" then falls out as `!isRequired || commitInvalidValues`.
const validationStateFor = (
  value: string,
  {
    isRequired,
    commitInvalidValues,
    validate = isNumber,
  }: {
    isRequired: boolean;
    commitInvalidValues: boolean;
    validate?: (value: number) => boolean;
  },
) => {
  const isEmpty = value.trim() === "";
  const numericValue = parseLocaleNumber(value);
  const isNonNumeric = !isEmpty && isNaN(numericValue);
  const hasError = isEmpty ? isRequired : !validate(numericValue);
  const isBlocked = isNonNumeric || (hasError && !commitInvalidValues);
  return { hasError, isBlocked };
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
