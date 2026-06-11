import { useMemo } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { Selector } from "@epanet-js/ui-kit";
import { type ZoneFeature, ZoneLabelGenerator } from "src/lib/zones";

const PREVIEW_LIMIT = 7;

export const DataMappingStep = ({
  selectedLabel,
  availableProperties,
  features,
  onSelectLabel,
}: {
  selectedLabel: string;
  availableProperties: string[];
  features: ZoneFeature[];
  onSelectLabel: (value: string) => void;
}) => {
  const translate = useTranslate();

  const noneLabel = translate("importZones.dataMappingStep.none");
  const propertyOptions = availableProperties.map((property) => ({
    label: property,
    value: property,
  }));

  const previewLabels = useMemo(
    () => buildPreviewLabels(features, selectedLabel),
    [features, selectedLabel],
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-size-base text-default mb-2">
        {translate("importZones.dataMappingStep.description")}
      </p>
      <Selector
        nullable
        placeholder={noneLabel}
        clearLabel={noneLabel}
        options={propertyOptions}
        selected={selectedLabel === "none" ? null : selectedLabel}
        onChange={(value) => onSelectLabel(value ?? "none")}
        ariaLabel={translate("importZones.dataMappingStep.description")}
      />
      <LabelPreviewTable labels={previewLabels} totalCount={features.length} />
    </div>
  );
};

const LabelPreviewTable = ({
  labels,
  totalCount,
}: {
  labels: string[];
  totalCount: number;
}) => {
  const translate = useTranslate();

  return (
    <div className="mt-4 border rounded-md overflow-hidden">
      <table className="w-full text-size-base">
        <thead>
          <tr className="bg-panel">
            <th className="text-left px-3 py-2 font-medium text-subtle">
              {translate("importZones.dataMappingStep.previewHeader")}
            </th>
          </tr>
        </thead>
        <tbody>
          {labels.map((label, i) => (
            <tr key={i} className="border-t border">
              <td className="px-3 py-1.5 text-default">{label}</td>
            </tr>
          ))}
          {totalCount > PREVIEW_LIMIT && (
            <tr className="border-t border">
              <td className="px-3 py-1.5 text-subtle italic">
                {translate(
                  "importZones.dataMappingStep.previewMore",
                  String(totalCount - PREVIEW_LIMIT),
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const buildPreviewLabels = (
  features: ZoneFeature[],
  selectedLabel: string,
): string[] => {
  const preview = features.slice(0, PREVIEW_LIMIT);

  if (selectedLabel === "none") {
    const generator = new ZoneLabelGenerator();
    return preview.map(() => generator.next());
  }

  return preview.map((f) => String(f.properties?.[selectedLabel] ?? ""));
};
