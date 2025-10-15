import { useTranslate } from "src/hooks/use-translate";
import { pluralize } from "src/lib/utils";
import { IWrappedFeature } from "src/types";
import { Quantities } from "src/model-metadata/quantities-spec";
import { SectionList } from "src/components/form/fields";
import { MultiAssetPropertiesTable } from "../multi-asset-properties-table";
import { MultiAssetActions } from "./actions";

export function MultiAssetPanel({
  selectedFeatures,
  quantitiesMetadata,
}: {
  selectedFeatures: IWrappedFeature[];
  quantitiesMetadata: Quantities;
}) {
  const translate = useTranslate();

  return (
    <SectionList>
      <div className="flex flex-col">
        <div className="flex items-center justify-between">
          <span className="font-semibold">
            {translate("selection")} (
            {pluralize(translate, "asset", selectedFeatures.length)})
          </span>
          <MultiAssetActions />
        </div>
      </div>
      <MultiAssetPropertiesTable
        selectedFeatures={selectedFeatures}
        quantitiesMetadata={quantitiesMetadata}
      />
    </SectionList>
  );
}
