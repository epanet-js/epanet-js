import { useMemo } from "react";
import type { HydraulicModel } from "src/hydraulic-model";
import { Pipe } from "src/hydraulic-model/asset-types/pipe";
import { listPipeMaterials } from "src/hydraulic-model/utilities/pipe-materials";
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
  const existingMaterials = useMemo(
    () => listPipeMaterials(hydraulicModel.assets),
    [hydraulicModel.assets],
  );

  return (
    <CreatableTextRow
      name="material"
      value={pipe.material ?? null}
      options={existingMaterials}
      comparison={comparison}
      onChange={onChange}
      readOnly={readOnly}
      paywall="pipeAttributes"
    />
  );
};
