import { useId, useMemo } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { MultiSelector, Selector } from "@epanet-js/ui-kit";
import { PaywallLockIcon } from "src/icons";
import type { ZoneFeature } from "src/lib/zones";
import { LabelManager } from "@epanet-js/hydraulic-model";

const PREVIEW_LIMIT = 7;
const NO_ATTRIBUTES: string[] = [];

export type AttributesSelection = {
  options: string[];
  selected: string[];
  isLocked: boolean;
  onToggle: (name: string) => void;
};

export const DataMappingStep = ({
  selectedLabel,
  availableProperties,
  features,
  onSelectLabel,
  attributes,
}: {
  selectedLabel: string;
  availableProperties: string[];
  features: ZoneFeature[];
  onSelectLabel: (value: string) => void;
  attributes?: AttributesSelection;
}) => {
  const translate = useTranslate();
  const labelSelectorId = useId();

  const noneLabel = translate("importZones.dataMappingStep.none");
  const propertyOptions = availableProperties.map((property) => ({
    label: property,
    value: property,
  }));

  const previewAttributes = attributes?.selected ?? NO_ATTRIBUTES;
  const previewRows = useMemo(
    () => buildPreviewRows(features, selectedLabel, previewAttributes),
    [features, selectedLabel, previewAttributes],
  );

  return (
    <div className="flex flex-col gap-2">
      {!attributes && (
        <p className="text-size-base text-default mb-2">
          {translate("importZones.dataMappingStep.description")}
        </p>
      )}
      <div className="flex gap-2">
        <div
          className={`${attributes ? "basis-1/2" : "flex-1"} min-w-0 flex flex-col gap-1`}
        >
          <label
            htmlFor={labelSelectorId}
            className="h-7 flex items-center text-size-base text-subtle font-semibold"
          >
            {translate("label")}
          </label>
          <Selector
            id={labelSelectorId}
            nullable
            placeholder={noneLabel}
            clearLabel={noneLabel}
            options={propertyOptions}
            selected={selectedLabel === "none" ? null : selectedLabel}
            onChange={(value) => onSelectLabel(value ?? "none")}
          />
        </div>
        {attributes && (
          <div className="basis-1/2 min-w-0">
            <AttributesSelector attributes={attributes} />
          </div>
        )}
      </div>
      <PreviewTable
        attributes={previewAttributes}
        rows={previewRows}
        totalCount={features.length}
      />
    </div>
  );
};

const AttributesSelector = ({
  attributes,
}: {
  attributes: AttributesSelection;
}) => {
  const translate = useTranslate();
  const selectorId = useId();
  const title = translate("customAttributes.title");
  const handleToggle = (name: string) => {
    if (attributes.isLocked) return;
    attributes.onToggle(name);
  };
  const options = attributes.options.map((name) => ({
    label: name,
    value: name,
  }));

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={selectorId}
        className="h-7 flex items-center gap-1 min-w-0 text-size-base text-subtle"
      >
        <span className="shrink-0 font-semibold">{title}</span>
        {attributes.isLocked && (
          <>
            <span aria-hidden className="shrink-0 flex items-center">
              <PaywallLockIcon size="sm" />
            </span>
            <span className="min-w-0 truncate text-size-small">
              {translate("paywall.tooltip")}
            </span>
          </>
        )}
      </label>
      <MultiSelector<string>
        id={selectorId}
        options={options}
        selected={attributes.selected}
        onOptionSelected={handleToggle}
        onOptionRemoved={handleToggle}
        valueLabel={translate(
          "importZones.dataMappingStep.attributesSelectedCount",
          String(attributes.selected.length),
        )}
        placeholder={translate(
          "importZones.dataMappingStep.attributesPlaceholder",
        )}
        disabled={attributes.options.length === 0}
        side="bottom"
      />
    </div>
  );
};

type PreviewRow = { label: string; values: string[] };

const PreviewTable = ({
  attributes,
  rows,
  totalCount,
}: {
  attributes: string[];
  rows: PreviewRow[];
  totalCount: number;
}) => {
  const translate = useTranslate();

  return (
    <div className="mt-4 border rounded-md overflow-x-auto">
      <table className="w-full text-size-base">
        <thead>
          <tr className="bg-panel">
            <th className="text-left px-3 py-2 font-medium text-subtle">
              {translate("importZones.dataMappingStep.previewHeader")}
            </th>
            {attributes.map((name) => (
              <th
                key={name}
                className="text-left px-3 py-2 font-medium text-subtle"
              >
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border">
              <td className="px-3 py-1.5 text-default">{row.label}</td>
              {row.values.map((value, j) => (
                <td key={j} className="px-3 py-1.5 text-default">
                  {value}
                </td>
              ))}
            </tr>
          ))}
          {totalCount > PREVIEW_LIMIT && (
            <tr className="border-t border">
              <td
                colSpan={attributes.length + 1}
                className="px-3 py-1.5 text-subtle italic"
              >
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

const buildPreviewRows = (
  features: ZoneFeature[],
  selectedLabel: string,
  attributes: string[],
): PreviewRow[] => {
  const preview = features.slice(0, PREVIEW_LIMIT);
  const labelManager = new LabelManager();

  return preview.map((feature, index) => ({
    label:
      selectedLabel === "none"
        ? labelManager.generateFor("zone", index)
        : String(feature.properties?.[selectedLabel] ?? ""),
    values: attributes.map((name) => String(feature.properties?.[name] ?? "")),
  }));
};
