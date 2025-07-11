import { styledPropertyInput } from "src/components/elements";
import useResettable from "src/hooks/use-resettable";
import { CoordProps } from "src/types";
import { Pair, OnChangeKey } from "../property-row";
import { coordPropsAttr } from "./value";

export function PropertyRowKey({
  pair,
  onChangeKey,
  x,
  y,
}: {
  pair: Pair;
  onChangeKey: OnChangeKey;
} & CoordProps) {
  const [key, value] = pair;
  const keyProps = useResettable({
    value: key,
    onCommit(newKey) {
      onChangeKey(key, newKey);
    },
  });
  return (
    <input
      spellCheck="false"
      type="text"
      className={styledPropertyInput("left", value === undefined)}
      {...coordPropsAttr({ x, y })}
      aria-label={`Key: ${key}`}
      {...keyProps}
    />
  );
}

export function PropertyRowKeyReadonly({
  pair,
  x,
  y,
}: {
  pair: Pair;
} & CoordProps) {
  const [key, value] = pair;
  const keyProps = useResettable({
    value: key,
    onCommit(_newKey) {},
  });
  return (
    <input
      spellCheck="false"
      type="text"
      readOnly
      disabled
      className={styledPropertyInput("left", value === undefined)}
      title={key}
      {...coordPropsAttr({ x, y })}
      aria-label={`Key: ${key}`}
      {...keyProps}
    />
  );
}
