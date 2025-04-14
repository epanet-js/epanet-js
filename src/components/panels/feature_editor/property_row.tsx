import React, { ReactNode } from "react";
import type { MultiPair } from "src/lib/multi_properties";
import { ExplicitCast } from "src/lib/cast";
import { styledTd } from "src/components/elements";
import type { JsonValue } from "type-fest";
import * as P from "@radix-ui/react-popover";
import { PropertyRowKeyReadonly } from "./property_row/key";
import { PropertyRowValue } from "./property_row/value";

export type OnChangeValue = (key: string, value: JsonValue) => void;
export type OnDeleteKey = (key: string) => void;
export type OnCast = (
  key: string,
  value: string,
  castType: ExplicitCast,
) => void;
export type OnChangeKey = (key: string, newKey: string) => void;
export type PropertyPair = [string, JsonValue | undefined];
export type Pair = PropertyPair | MultiPair;

export interface PropertyRowPropsDeprecated {
  pair: PropertyPair;
  onChangeValue: OnChangeValue;
  onChangeKey: OnChangeKey;
  onDeleteKey: OnDeleteKey;
  onCast: OnCast;
  y: number;
}

type PropertyRowProps = {
  label: string;
  children: ReactNode;
};

export const PropertyRow = ({ label, children }: PropertyRowProps) => {
  return (
    <P.Root>
      <tr className={"even:bg-gray-100"}>
        <td className={`border-r border-b border-t ${styledTd}`}>
          <PropertyRowKeyReadonly x={0} y={0} pair={[label, "any"]} />
        </td>
        <td className={`border-l border-b border-t relative ${styledTd}`}>
          {children}
        </td>
      </tr>
    </P.Root>
  );
};

export function PropertyRowReadonly({
  pair,
}: Pick<PropertyRowPropsDeprecated, "pair">) {
  return (
    <P.Root>
      <tr className="even:bg-gray-100">
        <td className={`border-r border-b border-t ${styledTd}`}>
          <PropertyRowKeyReadonly x={0} y={1} pair={pair} />
        </td>
        <td className={`border-l border-b border-t relative ${styledTd}`}>
          <PropertyRowValue
            readOnly
            onChangeValue={() => {}}
            onDeleteKey={() => {}}
            onCast={() => {}}
            pair={pair}
            table={true}
          />
        </td>
      </tr>
    </P.Root>
  );
}
