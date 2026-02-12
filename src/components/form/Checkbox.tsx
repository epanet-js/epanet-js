import { useRef, useEffect } from "react";

export const Checkbox = ({
  size = 4,
  disabled,
  ...props
}: { size?: number } & React.InputHTMLAttributes<HTMLInputElement>) => {
  return (
    <input
      type="checkbox"
      className={`
        w-${size} h-${size} text-purple-400 border-gray-300 rounded
        ${
          disabled
            ? "cursor-not-allowed bg-gray-200 opacity-50"
            : "cursor-pointer bg-gray-50 focus:ring-purple-500"
        }
      `}
      disabled={disabled}
      {...props}
    />
  );
};

export const TriStateCheckbox = ({
  checked,
  indeterminate,
  disabled = false,
  ariaLabel,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onChange: (checked: boolean) => void;
}) => {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className={`w-4 h-4 text-purple-400 border-gray-300 rounded ${
        disabled
          ? "cursor-not-allowed bg-gray-200 opacity-50"
          : "cursor-pointer bg-gray-50 focus:ring-purple-500"
      }`}
    />
  );
};
