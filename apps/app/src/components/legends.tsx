import { linearGradient } from "src/lib/color";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { localizeDecimal } from "@epanet-js/i18n";
import { useUserTracking } from "src/infra/user-tracking";
import { RangeColorRule } from "src/map/symbology/range-color-rule";
import { useAtomValue } from "jotai";
import {
  linkColorRuleAvailableAtom,
  linkSymbologyAtom,
  nodeColorRuleAvailableAtom,
  nodeSymbologyAtom,
} from "src/state/map-symbology";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useState } from "react";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import clsx from "clsx";
import { ChevronDownIcon, ChevronRightIcon, WarningIcon } from "src/icons";

export const Legends = () => {
  const nodeSymbology = useAtomValue(nodeSymbologyAtom);
  const linkSymbology = useAtomValue(linkSymbologyAtom);
  const isNodeRuleAvailable = useAtomValue(nodeColorRuleAvailableAtom);
  const isLinkRuleAvailable = useAtomValue(linkColorRuleAvailableAtom);
  const isMapThemesOn = useFeatureFlag("FLAG_MAP_THEMES");

  const isSmOrLarger = useBreakpoint("sm");
  if (!isSmOrLarger) return null;

  return (
    <div className="space-y-1 absolute w-48 top-2 left-2">
      {!!nodeSymbology.colorRule && (
        <Legend
          symbology={nodeSymbology.colorRule}
          isUnavailable={isMapThemesOn && !isNodeRuleAvailable}
        />
      )}
      {!!linkSymbology.colorRule && (
        <Legend
          symbology={linkSymbology.colorRule}
          isUnavailable={isMapThemesOn && !isLinkRuleAvailable}
        />
      )}
    </div>
  );
};

const Legend = ({
  symbology,
  isUnavailable = false,
}: {
  symbology: RangeColorRule;
  isUnavailable?: boolean;
}) => {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const userTracking = useUserTracking();
  const { property, unit } = symbology;

  const title = unit
    ? `${translate(property)} (${translateUnit(unit)})`
    : translate(property);

  const isSmOrLarger = useBreakpoint("sm");

  const [isExpanded, setExpanded] = useState(isSmOrLarger);

  return (
    <LegendContainer>
      <div
        className={clsx(
          "block w-full p-2 flex flex-col justify-between items-start gap-2",
          "cursor-pointer hover:bg-base-hover",
        )}
        onClick={() => {
          setExpanded(!isExpanded);
          userTracking.capture({
            name: "legend.clicked",
            property,
          });
        }}
      >
        <div className="flex w-full items-center justify-between">
          <div className="text-size-small text-wrap select-none">{title}</div>
          <span className="shrink-0">
            {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </span>
        </div>
        {isExpanded &&
          (isUnavailable ? (
            <div className="flex items-start gap-1 text-size-small text-subtle select-none">
              <WarningIcon className="shrink-0 text-warning" />
              <span>{translate("mapThemes.legendUnavailable")}</span>
            </div>
          ) : (
            <LegendRamp colorRule={symbology} />
          ))}
      </div>
    </LegendContainer>
  );
};

const LegendContainer = ({
  onClick,
  children,
}: {
  onClick?: () => void;
  children: React.ReactNode;
}) => {
  return (
    <div
      className={clsx(
        "space-y-1 text-size-small bg-base w-32",
        "rounded-sm border shadow-md",
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export const LegendRamp = ({ colorRule }: { colorRule: RangeColorRule }) => {
  const { colors, breaks, interpolate } = colorRule;
  return (
    <div
      className="relative w-4 h-32 rounded-sm dark:border dark:border-white "
      style={{
        background: linearGradient({
          colors: colors,
          interpolate: interpolate,
          vertical: true,
        }),
      }}
    >
      {Array.from({ length: breaks.length }).map((_, i) => {
        const topPct = ((i + 1) / (breaks.length + 1)) * 100;
        return (
          <div
            key={breaks[i] + "_" + i}
            className="absolute left-full ml-2 text-size-small whitespace-nowrap select-none"
            style={{
              top: `${topPct}%`,
              transform: "translateY(-50%)",
            }}
          >
            {localizeDecimal(breaks[i])}
          </div>
        );
      })}
    </div>
  );
};
