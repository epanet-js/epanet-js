import React, { useCallback, useRef } from "react";
import type { MultiPair } from "src/lib/multi_properties";
import type { JsonValue } from "type-fest";
import { CardStackIcon } from "@radix-ui/react-icons";
import { pluralize } from "src/lib/utils";
import * as P from "@radix-ui/react-popover";
import { useVirtual } from "react-virtual";
import {
  StyledPopoverArrow,
  StyledPopoverContent,
} from "src/components/elements";
import { CoordProps } from "src/types";
import { coordPropsAttr } from "src/components/panels/feature_editor/property_row/value";
import { localizeDecimal, translate } from "src/infra/i18n";

type MultiValueProps = CoordProps & {
  pair: MultiPair;
  onAccept: (arg0: JsonValue | undefined) => void;
};

const formatValue = (value: JsonValue | undefined): string => {
  if (!value) return "";
  if (typeof value === "number") {
    return localizeDecimal(value);
  }
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return String(value);

  return translate(value);
};

function ValueList({ pair }: Omit<MultiValueProps, "x" | "y">) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const values = Array.from(pair[1].entries());

  const rowVirtualizer = useVirtual({
    size: values.length,
    parentRef,
    estimateSize: useCallback(() => 28, []),
  });

  return (
    <div>
      <div className="pb-2 text-xs text-gray-500 font-bold">
        {translate("values")}
      </div>
      <div ref={parentRef} className="max-h-32 overflow-y-auto">
        <div
          className="w-full relative rounded"
          style={{
            height: `${rowVirtualizer.totalSize}px`,
          }}
        >
          {rowVirtualizer.virtualItems.map((virtualRow, i) => {
            const [value, times] = values[virtualRow.index];
            const isEven = i % 2 == 0;
            return (
              <button
                type="button"
                key={virtualRow.index}
                className={`top-0 left-0 block text-left w-full absolute py-1 px-1 flex items-center
                hover:bg-gray-200 dark:hover:bg-gray-700
                gap-x-2 cursor-default ${isEven ? "bg-gray-100" : ""} `}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="flex-auto font-mono text-xs truncate">
                  {formatValue(value)}
                </div>
                <div
                  className="text-xs font-mono"
                  title="Features with this value"
                >
                  ({times})
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function MultiValueEditor({ pair, onAccept, x, y }: MultiValueProps) {
  const [, value] = pair;
  return (
    <div>
      <P.Root>
        <P.Trigger
          {...coordPropsAttr({ x, y })}
          aria-label="Multiple values"
          className="group
          text-left font-mono
          text-xs px-1.5 py-2
          text-gray-700

          focus-visible:ring-inset
          focus-visible:ring-1
          focus-visible:ring-purple-500
          aria-expanded:ring-1
          aria-expanded:ring-purple-500

          gap-x-1 block w-full
          dark:text-white bg-transparent
          flex overflow-hidden"
        >
          <CardStackIcon />
          {pluralize("value", value.size)}
        </P.Trigger>
        <P.Portal>
          <StyledPopoverContent>
            <StyledPopoverArrow />
            <ValueList pair={pair} onAccept={onAccept} />
          </StyledPopoverContent>
        </P.Portal>
      </P.Root>
    </div>
  );
}
