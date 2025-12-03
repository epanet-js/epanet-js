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
}: {
  label: string;
  value: number | undefined;
  onChangeValue: (newValue: number | undefined) => void;
  isNullable?: boolean;
  tabIndex?: number;
}) => {
  const displayValue = formatSecondsToHHMM(value);
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
    setTimeout(() => inputRef.current && inputRef.current.select(), 0);
  };

  const handleCommitLastChange = () => {
    const seconds = parseHHMMToSeconds(inputValue);
    const finalValue = isNullable ? seconds : (seconds ?? 0);
    setInputValue(formatSecondsToHHMM(finalValue));
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
    newInputValue = newInputValue.replace(/[^0-9:]/g, "");
    setInputValue(newInputValue);

    const seconds = parseHHMMToSeconds(newInputValue);
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

const formatSecondsToHHMM = (seconds: number | undefined): string => {
  if (seconds === undefined) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
};

const parseHHMMToSeconds = (value: string): number | undefined => {
  if (!value || value.trim() === "") return undefined;
  const trimmed = value.trim();

  if (trimmed.includes(":")) {
    const [hoursStr, minutesStr] = trimmed.split(":");
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr || "0", 10);
    if (isNaN(hours) || isNaN(minutes)) return undefined;
    return hours * 3600 + minutes * 60;
  }

  const hours = parseInt(trimmed, 10);
  if (isNaN(hours)) return undefined;
  return hours * 3600;
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
