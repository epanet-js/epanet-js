import {
  ChangeEventHandler,
  FocusEventHandler,
  KeyboardEventHandler,
  useRef,
  useState,
  useEffect,
} from "react";
import clsx from "clsx";

export const TimeField = ({
  label,
  value,
  onChangeValue,
  isNullable = true,
  tabIndex = 1,
  hasError: externalError = false,
}: {
  label: string;
  value: number | undefined;
  onChangeValue: (newValue: number | undefined) => void;
  isNullable?: boolean;
  tabIndex?: number;
  hasError?: boolean;
}) => {
  const displayValue = formatSecondsToDisplay(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(displayValue);
  const [internalError, setError] = useState(false);
  const [isDirty, setDirty] = useState(false);
  const hasError = internalError || externalError;

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
    if (e.key === "Enter") {
      e.preventDefault();
      if (!internalError) {
        handleCommitLastChange();
      }
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
    if (isDirty && !internalError) {
      handleCommitLastChange();
    }
  };

  const handleFocus: FocusEventHandler<HTMLInputElement> = (e) => {
    e.preventDefault();
    setTimeout(() => inputRef.current && inputRef.current.select(), 0);
  };

  const handleCommitLastChange = () => {
    const seconds = parseValueToSeconds(inputValue);
    const finalValue = isNullable ? seconds : (seconds ?? 0);
    setInputValue(formatSecondsToDisplay(finalValue));
    onChangeValue(finalValue);

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
    newInputValue = newInputValue.replace(/[^0-9:.,]/g, "");
    setInputValue(newInputValue);

    const seconds = parseValueToSeconds(newInputValue);
    setError(seconds === undefined && newInputValue.trim() !== "");
    setDirty(true);
  };

  if (hasError && inputRef.current) {
    inputRef.current.className = styledInput({ variant: "warning" });
  }
  if (!hasError && inputRef.current) {
    inputRef.current.className = styledInput({});
  }

  return (
    <input
      onChange={handleInputChange}
      onKeyDown={handleKeyDown}
      spellCheck="false"
      type="text"
      aria-label={`Value for: ${label}`}
      onBlur={handleBlur}
      ref={inputRef}
      value={inputValue}
      onFocus={handleFocus}
      tabIndex={tabIndex}
      className={styledInput({})}
    />
  );
};

const formatSecondsToDisplay = (totalSeconds: number | undefined): string => {
  if (totalSeconds === undefined) return "";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (seconds !== 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${hours}:${String(minutes).padStart(2, "0")}`;
};

const parseValueToSeconds = (value: string): number | undefined => {
  if (!value || value.trim() === "") return undefined;
  const trimmed = value.trim();

  if (trimmed.includes(":")) {
    return parseTimeFormat(trimmed);
  }

  return parseDecimalHours(trimmed);
};

const parseTimeFormat = (value: string): number | undefined => {
  const parts = value.split(":");
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1] || "0", 10);
  const seconds = parseInt(parts[2] || "0", 10);
  if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return undefined;
  if (minutes > 59 || seconds > 59) return undefined;
  return hours * 3600 + minutes * 60 + seconds;
};

const parseDecimalHours = (value: string): number | undefined => {
  const normalized = value.replace(",", ".");
  const decimalHours = parseFloat(normalized);
  if (isNaN(decimalHours)) return undefined;
  return Math.round(decimalHours * 3600);
};

function styledInput({
  variant = "default",
}: {
  variant?: "default" | "warning";
} = {}) {
  return clsx(
    "text-gray-700 dark:text-gray-100",
    "p-2",
    "border focus-visible:border-transparent",
    variant === "warning"
      ? "border-orange-500 dark:border-orange-700"
      : "border-gray-300 hover:border-gray-200",
    {
      "focus-visible:bg-purple-300/10 dark:focus-visible:bg-purple-700/40 dark:focus-visible:ring-purple-700 focus-visible:ring-purple-500":
        variant === "default",
      "focus-visible:bg-orange-300/10 dark:focus-visible:bg-orange-700/40 dark:focus-visible:ring-orange-700 focus-visible:ring-orange-500":
        variant === "warning",
    },
    "text-xs",
    "bg-transparent rounded-sm block tabular-nums overflow-hidden whitespace-nowrap text-ellipsis focus-visible:ring-inset w-full",
  );
}
