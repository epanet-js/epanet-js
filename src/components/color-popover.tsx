import { HexColorPicker, HexColorInput } from "react-colorful";
import * as P from "@radix-ui/react-popover";
import { FieldProps } from "formik";
import * as E from "./elements";
import { useRef } from "react";

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
  const latestColor = useRef(color as string);

  const handlePickerChange = (newColor: string) => {
    latestColor.current = newColor;
  };

  const handlePointerUp = () => {
    onChange?.(latestColor.current);
  };

  const handleInputChange = (newColor: string) => {
    latestColor.current = newColor;
    onChange?.(newColor);
  };

  return (
    <P.Root>
      <P.Trigger asChild disabled={readonly}>
        <button
          className="h-full w-full rounded-sm"
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
              color={color}
              onChange={handlePickerChange}
              onBlur={onBlur}
            />
          </div>
          <HexColorInput
            className={E.inputClass({ _size })}
            prefixed
            color={color}
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
