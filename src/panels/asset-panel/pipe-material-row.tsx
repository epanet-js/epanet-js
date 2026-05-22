import { useMemo } from "react";
import type { HydraulicModel } from "src/hydraulic-model";
import { Pipe } from "src/hydraulic-model/asset-types/pipe";
import type { PropertyComparison } from "src/hooks/use-asset-comparison";
import { CreatableTextRow } from "./ui-components";

type OnMaterialChange = (
  name: "material",
  newValue: string | null,
  oldValue: string | null,
) => void;

export const PipeMaterialRow = ({
  pipe,
  hydraulicModel,
  comparison,
  onChange,
  readOnly = false,
}: {
  pipe: Pipe;
  hydraulicModel: HydraulicModel;
  comparison?: PropertyComparison;
  onChange?: OnMaterialChange;
  readOnly?: boolean;
}) => {
  const existingMaterials = useMemo(() => {
    const seen = new Map<string, string>();
    for (const asset of hydraulicModel.assets.values()) {
      if (asset.type !== "pipe") continue;
      const m = (asset as Pipe).material;
      if (!m) continue;
      const key = m.toLowerCase();
      if (!seen.has(key)) seen.set(key, m);
    }
    return Array.from(seen.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [hydraulicModel.assets]);

  return (
    <CreatableTextRow
      name="material"
      value={pipe.material ?? null}
      options={existingMaterials}
      comparison={comparison}
      onChange={onChange}
      readOnly={readOnly}
    />
  );
};
