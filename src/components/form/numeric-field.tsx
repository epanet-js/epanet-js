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
  styleOptions = {},
  tabIndex = 1,
}: {
  label: string;
  displayValue: string;
  onChangeValue?: (newValue: number, isEmpty: boolean) => void;
  isNullable?: boolean;
  positiveOnly?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  styleOptions?: Partial<StyleOptions>;
  tabIndex?: number;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(displayValue);
  const [hasError, setError] = useState(false);
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
    if (e.key === "Enter" && !hasError) {
      e.preventDefault();
      handleCommitLastChange();
      return;
    }
    if (e.key === "Enter" && hasError) {
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
    blurInput();
  };

  const handleBlur = () => {
    if (isDirty && !hasError) {
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
    blurInput();
  };

  const blurInput = () => {
    if (inputRef.current !== document.activeElement) return;

    setTimeout(() => inputRef.current && inputRef.current.blur(), 0);
  };

  const handleInputChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const newInputValue = normalizeNumericInput(e.target.value, { positiveOnly });
    setInputValue(newInputValue);
    const numericValue = parseLocaleNumber(newInputValue);
    setError(isNaN(numericValue) || (!isNullable && numericValue === 0));
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
      ? "text-gray-400 dark:text-gray-500 cursor-not-allowed"
      : "text-gray-700 dark:text-gray-100",
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
        : "border-gray-300 hover:border-gray-200",
    !ghostBorder && variant !== "warning" && "bg-white",
    !disabled && {
      "focus-visible:bg-purple-300/10 dark:focus-visible:bg-purple-700/40 dark:focus-visible:ring-purple-700 focus-visible:ring-purple-500":
        variant === "default",
      "focus-visible:bg-orange-300/10 dark:focus-visible:bg-orange-700/40 dark:focus-visible:ring-orange-700 focus-visible:ring-orange-500":
        variant === "warning",
    },
    {
      "text-xs": textSize === "xs",
      "text-sm": textSize === "sm",
      "text-md": textSize === "md",
    },

    "rounded-sm block tabular-nums overflow-hidden whitespace-nowrap text-ellipsis focus-visible:ring-inset w-full",
  );
}
