import {
  ChangeEventHandler,
  KeyboardEventHandler,
  forwardRef,
  useState,
  useRef,
  useImperativeHandle,
} from "react";
import clsx from "clsx";
import { Button } from "src/components/elements";
import { CheckIcon } from "src/icons";

type StyleOptions = {
  textSize?: "xs" | "sm" | "md";
  padding?: "md" | "sm";
};

type EditableTextFieldWithConfirmationProps = {
  label: string;
  value: string;
  onChangeValue?: (newValue: string) => boolean;
  onReset?: () => void;
  hasError?: boolean;
  placeholder?: string;
  allowedChars?: RegExp;
  maxByteLength?: number;
  styleOptions?: Partial<StyleOptions>;
};

export const EditableTextFieldWithConfirmation = forwardRef<
  HTMLInputElement,
  EditableTextFieldWithConfirmationProps
>(function EditableTextFieldWithConfirmation(
  {
    label,
    value,
    onChangeValue,
    onReset,
    hasError = false,
    placeholder,
    allowedChars,
    maxByteLength,
    styleOptions = {},
  },
  ref,
) {
  const [inputValue, setInputValue] = useState(value);
  const [isDirty, setDirty] = useState(false);
  const internalRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => internalRef.current!, []);

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
    setTimeout(() => internalRef.current?.select(), 0);
  };

  const handleCommitLastChange = () => {
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
    if (internalRef.current !== document.activeElement) return;

    setTimeout(() => internalRef.current?.blur(), 0);
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
  };

  const handleConfirm = () => {
    if (inputValue.trim()) {
      internalRef.current?.blur();
    }
  };

  const variant = hasError ? "warning" : "default";

  return (
    <div className="flex items-center gap-1">
      <input
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        spellCheck="false"
        type="text"
        aria-label={`Value for: ${label}`}
        onBlur={handleBlur}
        ref={internalRef}
        value={inputValue}
        onFocus={handleFocus}
        tabIndex={1}
        placeholder={placeholder}
        className={styledInput({
          ...styleOptions,
          variant,
        })}
      />
      <div className="self-stretch flex">
        <Button
          variant="quiet"
          size="sm"
          onClick={handleConfirm}
          disabled={!inputValue.trim()}
          className="h-full hover:bg-green-500/30 dark:hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckIcon size="sm" />
        </Button>
      </div>
    </div>
  );
});

function styledInput({
  padding = "md",
  variant = "default",
  textSize = "xs",
}: StyleOptions & { variant?: "default" | "warning" } = {}) {
  return clsx(
    "text-gray-700 dark:text-gray-100",
    {
      "p-1": padding === "sm",
      "p-2": padding === "md",
    },
    "border focus-visible:border-transparent",
    variant === "warning"
      ? "border-orange-500 dark:border-orange-700"
      : "border-gray-300 hover:border-gray-200",
    "bg-white dark:bg-gray-800",
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
    "rounded-sm block overflow-hidden whitespace-nowrap text-ellipsis w-full placeholder:italic",
    "focus-visible:ring-inset",
  );
}
