import {
  ChangeEventHandler,
  KeyboardEventHandler,
  forwardRef,
  useState,
  useRef,
  useImperativeHandle,
  useEffect,
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
  sanitize?: (raw: string) => string;
  styleOptions?: Partial<StyleOptions>;
  autoFocus?: boolean;
  forceValidation?: boolean;
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
    sanitize,
    styleOptions = {},
    autoFocus = false,
    forceValidation = false,
  },
  ref,
) {
  const [inputValue, setInputValue] = useState(value);
  const [isDirty, setDirty] = useState(false);
  const internalRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => internalRef.current!, []);

  useEffect(() => {
    if (autoFocus) {
      internalRef.current?.focus();
    }
  }, [autoFocus]);

  const handleContainerKeyDown: KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      resetInput();
    }
  };

  const handleInputKeyDown: KeyboardEventHandler<HTMLInputElement> = (e) => {
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

  const tryCommit = (): boolean => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue !== value || !trimmedValue || forceValidation) {
      const hasValidationError = onChangeValue?.(trimmedValue);
      if (hasValidationError) {
        return false;
      }
    }
    setDirty(false);
    return true;
  };

  const handleBlur = () => {
    if (isDirty || forceValidation) {
      if (!tryCommit()) {
        resetInput();
      }
    } else {
      resetInput();
    }
  };

  const handleFocus = () => {
    setTimeout(() => internalRef.current?.select(), 0);
  };

  const handleCommitLastChange = () => {
    if (tryCommit()) {
      blurInput();
    }
  };

  const blurInput = () => {
    if (internalRef.current !== document.activeElement) return;

    setTimeout(() => internalRef.current?.blur(), 0);
  };

  const handleInputChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const newValue = sanitize ? sanitize(e.target.value) : e.target.value;
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
    <div
      className="w-full flex items-center gap-1"
      onKeyDownCapture={handleContainerKeyDown}
      data-capture-escape-key
    >
      <input
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
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
    "text-default",
    {
      "p-1": padding === "sm",
      "p-2": padding === "md",
    },
    "border focus-visible:border-transparent",
    variant === "warning"
      ? "border-orange-500 dark:border-orange-700"
      : "border-strong hover:border",
    "bg-popover",
    {
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
    "rounded-xs block overflow-hidden whitespace-nowrap text-ellipsis w-full placeholder:italic",
    "focus-visible:ring-inset",
  );
}
