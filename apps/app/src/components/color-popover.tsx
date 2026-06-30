import { HexColorPicker, HexColorInput } from "react-colorful";
import * as P from "@radix-ui/react-popover";
import { FieldProps } from "formik";
import * as E from "./elements";
import { useRef } from "react";

const HEX_PATTERN = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const fallbackColor = "#000000";

const isValidHex = (value: string): boolean => HEX_PATTERN.test(value);

export function ColorPopoverField({
  field,
  form,
  ...other
}: FieldProps & React.ComponentProps<typeof ColorPopover>) {
  return (
    <ColorPopover
      color={field.value}
      onChange={(value) => {
        void form.setFieldValue(field.name, value);
      }}
      {...other}
    />
  );
}

export function ColorPopover({
  color,
  onChange,
  onBlur,
  _size = "sm",
  ariaLabel = "",
  readonly = false,
}: React.ComponentProps<typeof HexColorPicker> & {
  _size?: E.B3Size;
  ariaLabel?: string;
  readonly?: boolean;
}) {
  const safeColor = isValidHex(color as string)
    ? (color as string)
    : fallbackColor;
  const latestColor = useRef(safeColor);

  const handlePickerChange = (newColor: string) => {
    latestColor.current = newColor;
  };

  const handlePointerUp = () => {
    if (!isValidHex(latestColor.current)) return;
    onChange?.(latestColor.current);
  };

  const handleInputChange = (newColor: string) => {
    latestColor.current = newColor;
    if (!isValidHex(newColor)) return;
    onChange?.(newColor);
  };

  return (
    <P.Root>
      <P.Trigger asChild disabled={readonly}>
        <button
          className="h-full w-full rounded-xs"
          aria-label={ariaLabel}
          data-color={color}
          disabled={readonly}
          style={{ backgroundColor: color as string }}
        ></button>
      </P.Trigger>
      <E.PopoverContent2 size="no-width">
        <div className="space-y-2">
          <div
            className="border border-white"
            style={{ borderRadius: 5 }}
            onPointerUp={handlePointerUp}
          >
            <HexColorPicker
              color={safeColor}
              onChange={handlePickerChange}
              onBlur={onBlur}
            />
          </div>
          <HexColorInput
            className={E.inputClass({ _size })}
            prefixed
            color={safeColor}
            onChange={handleInputChange}
            aria-label="color input"
          />
          <P.Close asChild>
            <E.Button>Done</E.Button>
          </P.Close>
        </div>
      </E.PopoverContent2>
    </P.Root>
  );
}
