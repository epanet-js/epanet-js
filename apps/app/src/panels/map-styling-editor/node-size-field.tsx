import { useTranslate } from "src/hooks/use-translate";
import { InlineField } from "src/components/form/fields";
import { NodeSizePopover } from "./node-size-popover";
import { useJunctionSize } from "./use-junction-size";

// Owns node-size state and the debounced imperative map wiring (via the hook),
// and feeds it to the controlled popover. Scoped to nodes so links never mount it.
export function NodeSizeField({ readonly }: { readonly?: boolean }) {
  const translate = useTranslate();
  const { config, onChange } = useJunctionSize();

  return (
    <InlineField
      name={translate("nodeSize.label")}
      labelSize="sm"
      layout="fixed-label"
    >
      <NodeSizePopover value={config} onChange={onChange} readonly={readonly} />
    </InlineField>
  );
}
