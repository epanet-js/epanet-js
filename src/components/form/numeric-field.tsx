import {
  ChangeEventHandler,
  FocusEventHandler,
  KeyboardEventHandler,
  useRef,
  useState,
  useEffect,
} from "react";
import { parseLocaleNumber, reformatWithoutGroups } from "src/infra/i18n";
import clsx from "clsx";

type StyleOptions = {
  textSize?: "xs" | "sm" | "md";
  padding?: "md" | "sm";
  border?: "sm" | "none";
  ghostBorder?: boolean;
  variant?: "default" | "warning";
};

export const NumericField = ({
  label,
  displayValue,
  onChangeValue,
  positiveOnly = false,
  readOnly = false,
  isNullable = true,
  styleOptions = {},
}: {
  label: string;
  displayValue: string;
  onChangeValue?: (newValue: number) => void;
  isNullable?: boolean;
  positiveOnly?: boolean;
  readOnly?: boolean;
  styleOptions?: Partial<StyleOptions>;
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
    setInputValue(String(numericValue));
    onChangeValue && onChangeValue(numericValue);

    setDirty(false);
    setError(false);
    blurInput();
  };

  const blurInput = () => {
    if (inputRef.current !== document.activeElement) return;

    setTimeout(() => inputRef.current && inputRef.current.blur(), 0);
  };

  const handleInputChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    let newInputValue = e.target.value;
    newInputValue = newInputValue.replace(/[^0-9\-eE.,]/g, "");

    if (positiveOnly) {
      newInputValue = newInputValue.replace(/^-/g, "");
    }
    setInputValue(newInputValue);
    const numericValue = parseLocaleNumber(newInputValue);
    setError(isNaN(numericValue) || (!isNullable && numericValue === 0));
    setDirty(true);
  };

  if (hasError && inputRef.current) {
    inputRef.current.className = styledInput({
      ...styleOptions,
      variant: "warning",
    });
  }
  if (!hasError && inputRef.current) {
    inputRef.current.className = styledInput(styleOptions);
  }

  return (
    <input
      onChange={handleInputChange}
      onKeyDown={handleKeyDown}
      spellCheck="false"
      type="text"
      aria-label={`Value for: ${label}`}
      readOnly={readOnly}
      onBlur={handleBlur}
      ref={inputRef}
      value={inputValue}
      onFocus={handleFocus}
      tabIndex={1}
      className={styledInput(styleOptions)}
    />
  );
};

function styledInput({
  padding = "md",
  border = "sm",
  variant = "default",
  textSize = "xs",
  ghostBorder = false,
}: StyleOptions = {}) {
  return clsx(
    "text-gray-700 dark:text-gray-100",
    {
      "p-1": padding === "sm",
      "p-2": padding === "md",
    },
    {
      "border-none": border === "none",
      "border focus-visible:border-transparent": border === "sm",
    },
    ghostBorder ? "border-transparent" : "border-gray-300",
    {
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

    "bg-transparent block tabular-nums overflow-hidden whitespace-nowrap text-ellipsis focus-visible:ring-inset w-full",
  );
}
