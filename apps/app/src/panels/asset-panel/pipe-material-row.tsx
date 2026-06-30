import { useMemo } from "react";
import { useAtomValue } from "jotai";
import type { HydraulicModel } from "src/hydraulic-model";
import { Pipe } from "@epanet-js/hydraulic-model";
import { listPipeMaterials } from "src/hydraulic-model/utilities/pipe-materials";
import type { PropertyComparison } from "src/hooks/use-asset-comparison";
import { isValidMaterial } from "src/hydraulic-model/property-validators";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { pipeMaterialLabelsAtom } from "src/state/pipe-library";
import { CreatableTextRow } from "./ui-components";

type OnMaterialChange = (
  name: "material",
  newValue: string | undefined,
  oldValue: string | undefined,
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
  const isPipeLibraryOn = useFeatureFlag("FLAG_PIPE_LIBRARY");
  const libraryMaterials = useAtomValue(pipeMaterialLabelsAtom);
  const existingMaterials = useMemo(
    () =>
      listPipeMaterials(
        hydraulicModel.assets,
        isPipeLibraryOn ? libraryMaterials : [],
      ),
    [hydraulicModel.assets, isPipeLibraryOn, libraryMaterials],
  );

  return (
    <CreatableTextRow
      name="material"
      value={pipe.material}
      options={existingMaterials}
      isOptional
      comparison={comparison}
      onChange={onChange}
      readOnly={readOnly}
      paywall="pipeAttributes"
      validateNew={isValidMaterial}
    />
  );
};
