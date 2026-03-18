import { HexColorPicker, HexColorInput } from "react-colorful";
import * as P from "@radix-ui/react-popover";
import { FieldProps } from "formik";
import * as E from "./elements";
import debounce from "lodash/debounce";
import { useMemo } from "react";

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
}: React.ComponentProps<typeof HexColorPicker> & {
  _size?: E.B3Size;
  ariaLabel?: string;
}) {
  const debouncedOnChange = useMemo(() => {
    return debounce((color: string) => {
      onChange && onChange(color);
    }, 100);
  }, [onChange]);

  return (
    <P.Root>
      <P.Trigger asChild>
        <button
          className="h-full w-full rounded-sm"
          aria-label={ariaLabel}
          data-color={color}
          style={{
            backgroundColor: color,
          }}
        ></button>
      </P.Trigger>
      <E.PopoverContent2 size="no-width">
        <div className="space-y-2">
          <div className="border border-white" style={{ borderRadius: 5 }}>
            <HexColorPicker
              color={color}
              onChange={debouncedOnChange}
              onBlur={onBlur}
            />
          </div>
          <HexColorInput
            className={E.inputClass({ _size })}
            prefixed
            color={color}
            onChange={debouncedOnChange}
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
