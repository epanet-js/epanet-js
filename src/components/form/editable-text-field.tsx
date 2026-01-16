import {
  ChangeEventHandler,
  KeyboardEventHandler,
  useRef,
  useState,
  useEffect,
} from "react";
import clsx from "clsx";

type StyleOptions = {
  textSize?: "xs" | "sm" | "md";
  padding?: "md" | "sm";
  border?: "sm" | "none";
  ghostBorder?: boolean;
  variant?: "default" | "warning";
  disabled?: boolean;
  readOnly?: boolean;
  fontWeight?: "normal" | "semibold";
};

export const EditableTextField = ({
  label,
  value,
  onChangeValue,
  readOnly = false,
  disabled = false,
  styleOptions = {},
  tabIndex = 1,
  allowedChars,
  maxByteLength,
  onDirty,
  onReset,
  hasError = false,
}: {
  label: string;
  value: string;
  onChangeValue?: (newValue: string) => boolean;
  readOnly?: boolean;
  disabled?: boolean;
  styleOptions?: Partial<StyleOptions>;
  tabIndex?: number;
  allowedChars?: RegExp;
  maxByteLength?: number;
  onDirty?: () => void;
  onReset?: () => void;
  hasError?: boolean;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(value);
  const [isDirty, setDirty] = useState(false);

  useEffect(() => {
    if (!isDirty && document.activeElement !== inputRef.current) {
      setInputValue(value);
    }
  }, [value, isDirty]);

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Escape") {
      resetInput();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommitLastChange();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "y")) {
      e.preventDefault();
    }
  };

  const resetInput = () => {
    setInputValue(value);
    setDirty(false);
    onReset?.();
    blurInput();
  };

  const handleBlur = () => {
    if (isDirty) {
      handleCommitLastChange();
    } else {
      resetInput();
    }
  };

  const handleFocus = () => {
    setTimeout(() => inputRef.current && inputRef.current.select(), 0);
  };

  const handleCommitLastChange = () => {
    if (hasError) {
      return;
    }
    const trimmedValue = inputValue.trim();
    if (trimmedValue && trimmedValue !== value) {
      const hasValidationError = onChangeValue?.(trimmedValue);
      if (hasValidationError) {
        return;
      }
    }
    setDirty(false);
    blurInput();
  };

  const blurInput = () => {
    if (inputRef.current !== document.activeElement) return;

    setTimeout(() => inputRef.current?.blur(), 0);
  };

  const handleInputChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    let newValue = e.target.value;
    if (allowedChars) {
      newValue = newValue
        .split("")
        .filter((char) => allowedChars.test(char))
        .join("");
    }
    if (maxByteLength !== undefined) {
      const encoder = new TextEncoder();
      while (encoder.encode(newValue).length > maxByteLength) {
        newValue = newValue.slice(0, -1);
      }
    }
    setInputValue(newValue);
    setDirty(true);
    onDirty?.();
  };

  const variant = hasError ? "warning" : styleOptions.variant;

  if (readOnly) {
    return (
      <span
        className={styledReadOnlyText(styleOptions)}
        aria-label={`Value for: ${label}`}
      >
        {value}
      </span>
    );
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
      className={styledInput({
        ...styleOptions,
        variant,
        disabled,
        readOnly,
      })}
    />
  );
};

function styledReadOnlyText({
  padding = "md",
  textSize = "xs",
  fontWeight = "normal",
}: Partial<StyleOptions> = {}) {
  return clsx(
    "text-gray-700 dark:text-gray-100",
    {
      "p-1": padding === "sm",
      "p-2": padding === "md",
    },
    {
      "text-xs": textSize === "xs",
      "text-sm": textSize === "sm",
      "text-md": textSize === "md",
    },
    {
      "font-normal": fontWeight === "normal",
      "font-semibold": fontWeight === "semibold",
    },
    "block overflow-hidden whitespace-nowrap text-ellipsis w-full border border-transparent",
  );
}

function styledInput({
  padding = "md",
  border = "sm",
  variant = "default",
  textSize = "xs",
  ghostBorder = false,
  disabled = false,
  readOnly = false,
  fontWeight = "normal",
}: StyleOptions = {}) {
  const isInteractive = !disabled && !readOnly;

  return clsx(
    disabled
      ? "text-gray-400 dark:text-gray-500 cursor-not-allowed"
      : "text-gray-700 dark:text-gray-100",
    readOnly && "cursor-default",
    {
      "p-1": padding === "sm",
      "p-2": padding === "md",
    },
    {
      "border-none": border === "none",
      "border focus-visible:border-transparent":
        border === "sm" && isInteractive,
      border: border === "sm" && !isInteractive,
    },
    ghostBorder && variant !== "warning"
      ? "border-transparent bg-transparent"
      : variant === "warning"
        ? "border-orange-500 dark:border-orange-700"
        : isInteractive
          ? "border-gray-300 hover:border-gray-200"
          : "border-transparent",
    !ghostBorder && variant !== "warning" && "bg-white dark:bg-gray-800",
    isInteractive && {
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
    {
      "font-normal": fontWeight === "normal",
      "font-semibold": fontWeight === "semibold",
    },
    "rounded-sm block overflow-hidden whitespace-nowrap text-ellipsis w-full",
    isInteractive && "focus-visible:ring-inset",
  );
}
