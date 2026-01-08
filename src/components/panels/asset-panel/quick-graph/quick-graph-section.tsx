import { useCallback, useMemo } from "react";
import { useAtom, useAtomValue } from "jotai";
import { PinIcon, PinOffIcon } from "src/icons";
import { Button } from "src/components/elements";
import { Section } from "src/components/form/fields";
import { Selector } from "src/components/form/selector";
import { useTranslate } from "src/hooks/use-translate";
import { simulationAtom } from "src/state/jotai";
import {
  quickGraphPinnedAtom,
  quickGraphPropertyAtom,
  QUICK_GRAPH_PROPERTIES,
  type QuickGraphAssetType,
  type QuickGraphPropertyByAssetType,
} from "src/state/quick-graph";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

interface QuickGraphSectionProps {
  assetId: number;
  assetType: QuickGraphAssetType;
}

const QuickGraphSection = ({ assetType }: QuickGraphSectionProps) => {
  const translate = useTranslate();
  const simulation = useAtomValue(simulationAtom);
  const [isPinned, setIsPinned] = useAtom(quickGraphPinnedAtom);
  const [propertyByType, setPropertyByType] = useAtom(quickGraphPropertyAtom);

  const selectedProperty = propertyByType[assetType];

  const propertyOptions = useMemo(() => {
    const options = QUICK_GRAPH_PROPERTIES[assetType];
    return options.map((opt) => ({
      value: opt.value,
      label: translate(opt.labelKey),
    }));
  }, [assetType, translate]);

  const handlePropertyChange = useCallback(
    (value: QuickGraphPropertyByAssetType[typeof assetType]) => {
      setPropertyByType((prev) => ({
        ...prev,
        [assetType]: value,
      }));
    },
    [assetType, setPropertyByType],
  );

  const handlePinToggle = useCallback(() => {
    setIsPinned((prev) => !prev);
  }, [setIsPinned]);

  const hasSimulation =
    simulation.status === "success" || simulation.status === "warning";

  if (!hasSimulation) {
    return null;
  }

  const pinButton = (
    <Button
      variant="ultra-quiet"
      size="xxs"
      onClick={handlePinToggle}
      title={isPinned ? translate("unpin") : translate("pin")}
      aria-label={isPinned ? translate("unpin") : translate("pin")}
      data-state-on={isPinned || undefined}
    >
      {isPinned ? <PinIcon size="sm" /> : <PinOffIcon size="sm" />}
    </Button>
  );

  return (
    <Section title={translate("quickGraph")} button={pinButton}>
      <Selector
        options={propertyOptions}
        selected={selectedProperty}
        onChange={handlePropertyChange}
        styleOptions={{
          textSize: "text-xs",
          border: true,
          paddingX: 2,
          paddingY: 1,
        }}
      />
    </Section>
  );
};

const QuickGraphFeature = ({ assetId, assetType }: QuickGraphSectionProps) => {
  const isQuickGraphEnabled = useFeatureFlag("FLAG_QUICK_GRAPH");
  return isQuickGraphEnabled ? (
    <QuickGraphSection assetId={assetId} assetType={assetType} />
  ) : null;
};

export const QuickGraph = QuickGraphFeature;
