import clsx from "clsx";
import { Tooltip } from "@epanet-js/ui-kit";
import { Button, Keycap, B3Variant } from "src/components/elements";
import { localizeKeybinding } from "src/infra/i18n";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureLock } from "src/components/form/paywall";
import type { PaywallFeature } from "src/state/dialog";
import type { PaywallLockSource } from "src/infra/user-tracking";

export interface Action {
  onSelect: (event?: Event) => Promise<void>;
  icon: React.ReactNode;
  label: string;
  applicable: boolean;
  priority?: number;
  variant?: B3Variant;
  shortcut?: string;
  selected?: boolean;
  disabled?: boolean;
  lockedFeature?: PaywallFeature;
  lockSource?: PaywallLockSource;
}

export const useActionLock = ({
  label,
  onSelect,
  lockedFeature,
  lockSource,
}: Pick<Action, "label" | "onSelect" | "lockedFeature" | "lockSource">) => {
  const translate = useTranslate();
  const { isLocked, openPaywall } = useFeatureLock(lockedFeature, lockSource);

  return {
    isLocked,
    label: isLocked ? `${translate("paywall.tooltip")}: ${label}` : label,
    onSelect: isLocked
      ? () => {
          openPaywall();
          return Promise.resolve();
        }
      : onSelect,
  };
};

export function ActionButton({ action }: { action: Action }) {
  const {
    icon,
    label,
    variant = "quiet",
    shortcut,
    selected = false,
    disabled = false,
  } = action;
  const { isLocked, label: displayLabel, onSelect } = useActionLock(action);

  return (
    <Tooltip
      delayDuration={700}
      content={
        <div className="flex gap-x-2 items-center whitespace-nowrap">
          {displayLabel}
          {shortcut ? (
            <Keycap size="xs">{localizeKeybinding(shortcut)}</Keycap>
          ) : null}
        </div>
      }
    >
      <Button
        variant={selected ? "quiet/mode" : variant}
        aria-expanded={selected ? "true" : "false"}
        disabled={disabled}
        aria-label={displayLabel}
        data-action={label}
        aria-disabled={isLocked || undefined}
        className={clsx(
          "h-8",
          disabled ? "cursor-not-allowed" : "",
          isLocked ? "opacity-50" : "",
        )}
        onClick={(evt) => !disabled && onSelect(evt as unknown as Event)}
      >
        {icon}
      </Button>
    </Tooltip>
  );
}
