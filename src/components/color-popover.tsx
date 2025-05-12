//TODO: CHECK LINTER ERRORS
/* eslint-disable */
import {
  HexColorPicker,
  HexColorInput,
  RgbaStringColorPicker,
} from "react-colorful";
import * as P from "@radix-ui/react-popover";
import { FieldProps } from "formik";
import * as d3 from "d3-color";
import clsx from "clsx";
import * as E from "./elements";
import debounce from "lodash/debounce";
import { useMemo} from "react";

export function ColorPopoverField({
  field,
  form,
  ...other
}: FieldProps & React.ComponentProps<typeof ColorPopover>) {
  return (
    <ColorPopover
      color={field.value}
      onChange={(value) => {
        form.setFieldValue(field.name, value);
      }}
      {...other}
    />
  );
}

/**
 * Helpers, from d3-color. Remove these
 * when I can finally use ESM modules.
 */
function clampi(value: number) {
  return Math.max(0, Math.min(255, Math.round(value) || 0));
}

function hex(value: number) {
  value = clampi(value);
  return (value < 16 ? "0" : "") + value.toString(16);
}

function rgba2hex(orig: string): string {
  const c = d3.color(orig);
  if (c === null) return "";
  if (c.opacity !== 1) {
    return `${c.formatHex()}${hex(c.opacity * 255)}`;
  }
  return c.formatHex();
}

function color2rgb(orig: string): string {
  const c = d3.color(orig);
  if (c === null) return "rgba(0, 0, 0, 0)";
  return c.formatRgb();
}

export function ColorPopover({
  color,
  onChange,
  onBlur,
  _size = "sm",
  ariaLabel = "",
}: React.ComponentProps<typeof HexColorPicker> & {
  _size?: E.B3Size;
  ariaLabel?: string
}) {


  const debouncedOnChange = useMemo(() => {
    return debounce((color: string) => {
      onChange && onChange(color);
    }, 100);
  }, [onChange]);

  return (
    <P.Root>
      <P.Trigger
        asChild
      >
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
            alpha
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
