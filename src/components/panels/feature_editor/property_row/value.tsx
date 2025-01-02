import * as E from "src/components/elements";
import noop from "lodash/noop";
import useResettable from "src/hooks/use_resettable";
import isObject from "lodash/isObject";
import {
  PropertyPair,
  OnChangeValue,
  OnCast,
  OnDeleteKey,
} from "../property_row";
import * as P from "@radix-ui/react-popover";
import * as Select from "@radix-ui/react-select";
import {
  useMemo,
  useEffect,
  useRef,
  useState,
  KeyboardEventHandler,
  ChangeEventHandler,
} from "react";
import { atom, PrimitiveAtom, useAtomValue } from "jotai";

import { JsonValue } from "type-fest";
import { asHTML } from "src/lib/cast";
import * as d3 from "d3-color";

import { EditorState } from "@codemirror/state";
import {
  lineNumbers,
  EditorView,
  drawSelection,
  keymap,
} from "@codemirror/view";
import { history, historyKeymap, defaultKeymap } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import { placemarkTheme } from "src/lib/codemirror_theme";
import { CoordProps } from "src/types";
import { dataAtom } from "src/state/jotai";
import { truncate } from "src/lib/utils";
import { CheckIcon, ChevronDownIcon } from "@radix-ui/react-icons";

type Preview =
  | {
      kind: "html";
      value: string;
    }
  | {
      kind: "code";
      value: string;
    };

type NewValueAtom = PrimitiveAtom<PropertyPair[1]>;

export function coordPropsAttr({ x, y }: CoordProps) {
  return {
    "data-focus-x": x,
    "data-focus-y": y,
  };
}

export default function SimpleText({
  value,
  onChange,
  readOnly,
}: {
  value: string;
  onChange: (arg0: string) => void;
  readOnly?: boolean;
}) {
  const mountPointRef = useRef<null>(null);
  const editorRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!editorRef.current && window && mountPointRef.current) {
      const onChanges = EditorView.updateListener.of((v) => {
        if (!v.docChanged) return;
        const val = instance.state.doc.toString();
        onChange(val);
      });
      const instance = new EditorView({
        state: EditorState.create({
          doc: value,
          extensions: [
            keymap.of([...defaultKeymap, ...historyKeymap]),
            history(),
            drawSelection(),
            placemarkTheme,
            lineNumbers(),
            json(),
            onChanges,
            EditorState.readOnly.of(!!readOnly),
          ],
        }),
        parent: mountPointRef.current,
      });

      editorRef.current = instance;
    }
    return () => {};
  }, [value, onChange, readOnly]);

  return (
    <div
      className="flex-auto h-64
        border border-gray-300 dark:border-gray-600 rounded
        overflow-hidden
        focus-visible:border-gray-300"
      ref={mountPointRef}
    />
  );
}

/**
 * Display a value type as a single character symbol,
 * meant to be used in the dropdown on each feature row.
 */
export function asSymbol(value: JsonValue): string {
  switch (typeof value) {
    case "string": {
      return `String`;
    }
    case "number": {
      return "Number";
    }
    case "boolean": {
      return "Boolean";
    }
    case "object": {
      if (value && "@type" in value && value["@type"] === "html") {
        return "HTML";
      }
      return "Object";
    }
    default: {
      return "Other";
    }
  }
}

export enum EditorTab {
  JSON = "json",
  TEXT = "text",
  RICH_TEXT = "rich-text",
  COLOR = "color",
}

export function guessTab(value: JsonValue | undefined): EditorTab {
  if (typeof value === "string" && value.length < 80 && d3.color(value)) {
    return EditorTab.COLOR;
  }
  if (typeof value !== "string") {
    if (isObject(value) && "@type" in value && value["@type"] === "html") {
      return EditorTab.RICH_TEXT;
    }
    return EditorTab.JSON;
  }

  return EditorTab.TEXT;
}

/**
 * Edit a boolean value with a checkbox
 */
function BooleanEditor({
  pair,
  x,
  y,
  onChangeValue,
}: {
  pair: PropertyPair;
  onChangeValue: OnChangeValue;
} & CoordProps) {
  return (
    <label
      {...coordPropsAttr({ x, y })}
      className="select-none block py-2 px-2 flex items-center gap-x-2 text-xs dark:text-white"
    >
      <input
        checked={Boolean(pair[1])}
        onChange={(e) => {
          onChangeValue(pair[0], e.target.checked);
        }}
        type="checkbox"
        className={E.styledCheckbox({ variant: "default" })}
      />
      {pair[1] ? "True" : "False"}
    </label>
  );
}

/**
 * You can’t edit a JSON value inline. Instead, show a preview
 * and trigger the popover when it is clicked.
 */
function PropertyJSONPreview({
  value,
  x,
  y,
}: {
  value: JsonValue | undefined;
  readOnly?: boolean;
} & CoordProps) {
  const preview: Preview = useMemo(() => {
    return asHTML(value)
      .map((value): Preview => {
        return {
          kind: "html",
          value: String(value.value).slice(0, 100),
        };
      })
      .orDefaultLazy((): Preview => {
        return {
          kind: "code",
          value: JSON.stringify(value).slice(0, 100),
        };
      });
  }, [value]);
  return (
    <P.Trigger
      aria-label="Edit JSON property"
      className={`h-8
      ${preview.kind === "html" ? "" : "font-mono"}
      text-left text-xs
      truncate
      block w-full dark:bg-transparent
      focus-visible:ring-inset
      focus-visible:ring-1 focus-visible:ring-purple-500
      truncate text-gray-900 dark:text-gray-100`}
      {...coordPropsAttr({ x, y })}
    >
      <div className="truncate absolute top-0 bottom-0 left-2 right-0 flex items-center">
        {preview.value || <span className="opacity-0">|</span>}
      </div>
    </P.Trigger>
  );
}

export const Selector = <T extends string>({
  options,
  selected,
  onChange,
}: {
  options: { label: string; value: T }[];
  selected: { label: string; value: T };
  onChange: (selected: T) => void;
}) => {
  const [isOpen, setOpen] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.code === "Escape" || event.code === "Enter") {
      event.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="relative group-1">
      <Select.Root
        value={selected.value}
        open={isOpen}
        onOpenChange={handleOpenChange}
        onValueChange={onChange}
      >
        <Select.Trigger
          aria-label={`Value for: Status`}
          className="flex items-center text-xs text-gray-700 dark:items-center justify-between w-full min-w-[90px] pr-1 pl-2 pl-min-2 py-2 focus:ring-inset focus:ring-1 focus:ring-purple-500 focus:bg-purple-300/10"
        >
          <Select.Value />
          <Select.Icon>
            <ChevronDownIcon />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            onKeyDown={handleKeyDown}
            onCloseAutoFocus={(e) => e.preventDefault()}
            className="bg-white w-full border text-xs rounded-md shadow-md"
          >
            <Select.Viewport className="p-1">
              {options.map((option, i) => (
                <Select.Item
                  key={i}
                  value={option.value}
                  className="flex items-center px-2 py-2 cursor-pointer focus:bg-purple-300/40"
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="ml-auto">
                    <CheckIcon className="text-purple-700" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
};

/**
 * Edit a text value with a text input
 *
 * PropertyRowValue -> TextEditor
 */
export function TextEditor({
  pair,
  x,
  y,
  table = false,
  onChangeValue,
  readOnly = false,
}: {
  pair: PropertyPair;
  table: boolean;
  onChangeValue: OnChangeValue;
  readOnly?: boolean;
} & CoordProps) {
  const { featureMapDeprecated } = useAtomValue(dataAtom);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dirty, setDirty] = useState<boolean>(false);

  const [key, value] = pair;
  const valueProps = useResettable({
    value: value === undefined ? "" : value === null ? "null" : String(value),
    onCommit(value) {
      onChangeValue(key, value);
    },
    onBlur() {
      setDirty(false);
    },
    onChange() {
      setDirty(true);
    },
  });

  const isEmpty = value === undefined || value === "";

  // Optimization: only compute props that we might show
  const enableProperties = dirty || isEmpty;

  const topProperties = useMemo(() => {
    if (inputRef.current !== document.activeElement) return [];
    if (!enableProperties) return [];

    const [key] = pair;
    const counts = new Map<string | number, number>();

    const currentValue = valueProps.value;

    for (const { feature } of featureMapDeprecated.values()) {
      const value = feature.properties?.[key];
      if (
        value !== currentValue &&
        value !== "" &&
        (typeof value === "string" || typeof value === "number")
      ) {
        if (
          !currentValue ||
          String(value)
            .toLowerCase()
            .includes(String(currentValue).toLowerCase())
        ) {
          counts.set(value, (counts.get(value) || 0) + 1);
        }
      }
    }

    const head = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map((a) => a[0]);

    return head;
  }, [pair, valueProps.value, featureMapDeprecated, enableProperties]);

  const showOptions = enableProperties && topProperties.length > 0;

  return (
    <P.Root open={showOptions}>
      <P.Anchor asChild>
        <input
          spellCheck="false"
          type="text"
          {...coordPropsAttr({ x, y })}
          className={E.styledPropertyInput(table ? "table" : "right")}
          aria-label={`Value for: ${key}`}
          readOnly={readOnly}
          {...valueProps}
          ref={inputRef}
        />
      </P.Anchor>
      <P.Portal>
        <E.StyledPopoverContent
          size="xs"
          flush="yes"
          side="bottom"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div
            className="overflow-y-auto divide-y
            divide-gray-200 dark:divide-gray-900
            placemark-scrollbar w-full text-xs rounded-md"
            style={{
              maxHeight: 100,
            }}
          >
            {topProperties.map((value, i) => {
              return (
                <button
                  className="block w-full text-left truncate py-1 px-2
                    bg-gray-100 dark:bg-gray-700
                    opacity-75 hover:opacity-100"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChangeValue(pair[0], value);
                  }}
                  key={i}
                  title={String(value)}
                >
                  {truncate(String(value), 24)}
                </button>
              );
            })}
          </div>
        </E.StyledPopoverContent>
      </P.Portal>
    </P.Root>
  );
}

export function NumericField({
  label,
  value,
  onChangeValue,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChangeValue: (newValue: string) => void;
  readOnly?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [isDirty, setDirty] = useState(false);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter" || e.key === "Escape") {
      handleCommitLastChange();
    }
  };

  const handleBlur = () => {
    if (isDirty) {
      handleCommitLastChange();
    }
  };

  const handleCommitLastChange = () => {
    onChangeValue(inputValue);
    setDirty(false);
    setTimeout(() => {
      if (inputRef.current) inputRef.current.blur();
    }, 0);
  };

  const handleInputChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    setInputValue(e.target.value);
    setDirty(true);
  };

  return (
    <div className="relative group-1">
      <input
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        spellCheck="false"
        type="text"
        className={E.styledPropertyInput("right")}
        aria-label={`Value for: ${label}`}
        readOnly={readOnly}
        onBlur={handleBlur}
        ref={inputRef}
        value={inputValue}
      />
    </div>
  );
}

/**
 * The "value" part of a property
 */
export function PropertyRowValue({
  pair,
  onChangeValue,
  onFocus = noop,
  /**
   * Whether this value is in a table
   */
  table = false,
  readOnly = false,
  x,
  y,
}: {
  pair: PropertyPair;
  onChangeValue: OnChangeValue;
  onDeleteKey: OnDeleteKey;
  onFocus?: () => void;
  table?: boolean;
  readOnly?: boolean;
  even: boolean;
  onCast: OnCast;
} & CoordProps) {
  // Some of the editors don’t change values
  // immediately, like the color picker. So
  // we create a sort of "transient" value here.
  const [key, value] = pair;
  const newValueAtom: NewValueAtom = useMemo(() => atom(value), [value]);
  const newValue = useAtomValue(newValueAtom);

  return (
    <div onFocus={onFocus} className="relative group-1">
      <P.Root
        onOpenChange={(open) => {
          if (!open) {
            onChangeValue(key, newValue!);
          }
        }}
      >
        {isObject(value) ? (
          <PropertyJSONPreview value={value} x={x} y={y} readOnly={readOnly} />
        ) : typeof value === "boolean" ? (
          <BooleanEditor
            pair={pair}
            onChangeValue={onChangeValue}
            x={x}
            y={y}
          />
        ) : (
          <TextEditor
            table={table}
            pair={pair}
            onChangeValue={onChangeValue}
            readOnly={readOnly}
            x={x}
            y={y}
          />
        )}
      </P.Root>
    </div>
  );
}
