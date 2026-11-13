import * as Slider from "@radix-ui/react-slider";
import clsx from "clsx";

export const InlineSlider = ({
  id,
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
  ariaLabel,
  valueLabel,
  valueClassName = "w-4",
  disabled,
}: {
  id?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  ariaLabel: string;
  valueLabel?: string;
  valueClassName?: string;
  disabled?: boolean;
}) => (
  <div className="flex flex-1 items-center gap-2 h-8">
    <Slider.Root
      className="relative flex items-center grow h-8 select-none touch-none"
      min={min}
      max={max}
      step={step}
      value={[value]}
      onValueChange={([next]) => onChange(next)}
      onValueCommit={onCommit ? ([next]) => onCommit(next) : undefined}
      disabled={disabled}
    >
      <Slider.Track className="relative grow rounded-full h-2 bg-gray-200 dark:bg-gray-700">
        <Slider.Range className="absolute h-full rounded-full bg-accent" />
      </Slider.Track>
      <Slider.Thumb
        id={id}
        aria-label={ariaLabel}
        className="block w-4 h-4 rounded-full bg-base border-2 border-accent shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
      />
    </Slider.Root>
    <span
      className={clsx(
        "text-size-base text-subtle tabular-nums text-right shrink-0",
        valueClassName,
      )}
    >
      {valueLabel ?? value}
    </span>
  </div>
);
