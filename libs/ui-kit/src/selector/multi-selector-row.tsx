import React from "react";
import clsx from "clsx";
import { CheckIcon } from "../icons";
import type { SelectorListOption } from "./selector-list";

export function MultiSelectorRow<T extends string | number>({
  id,
  option,
  isSelected,
  isActive,
  className,
  style,
  onActivate,
  onToggle,
}: {
  id?: string;
  option: SelectorListOption<T>;
  isSelected: boolean;
  isActive: boolean;
  className?: string;
  style?: React.CSSProperties;
  onActivate: () => void;
  onToggle: (value: T) => void;
}) {
  const isOptionDisabled = !!option.disabled;
  return (
    <li
      id={id}
      role="option"
      aria-selected={isSelected}
      aria-disabled={isOptionDisabled}
      style={style}
      className={clsx(
        "flex items-center gap-2 h-8 px-2 rounded-sm",
        style && "absolute top-0 left-1 right-1",
        isOptionDisabled
          ? "cursor-default text-disabled"
          : "cursor-pointer text-default",
        !isOptionDisabled && isActive && "bg-base-hover",
        !isOptionDisabled && !isActive && "hover:bg-base-hover",
        className,
      )}
      onMouseEnter={isOptionDisabled ? undefined : onActivate}
      onMouseDown={(e) => e.preventDefault()}
      onClick={isOptionDisabled ? undefined : () => onToggle(option.value)}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "flex items-center justify-center w-4 h-4 rounded border shrink-0",
          isSelected
            ? "bg-accent border-transparent"
            : "bg-panel border-strong",
        )}
      >
        {isSelected && <CheckIcon size={12} className="text-white" />}
      </span>
      <span className="flex items-baseline gap-1 min-w-0">
        <span className="text-nowrap overflow-hidden text-ellipsis">
          {option.label}
        </span>
        {option.description && (
          <span className="text-nowrap text-subtle">{option.description}</span>
        )}
      </span>
    </li>
  );
}
