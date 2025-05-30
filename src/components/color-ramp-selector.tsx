import {
  CARTO_COLOR_DIVERGING,
  CARTO_COLOR_SEQUENTIAL,
  CBColors,
  COLORBREWER_ALL,
  COLORBREWER_DIVERGING,
  COLORBREWER_SEQUENTIAL,
} from "src/lib/colorbrewer";
import * as Select from "@radix-ui/react-select";
import { linearGradient } from "src/lib/color";
import { ChevronDownIcon, UpdateIcon } from "@radix-ui/react-icons";
import { translate } from "src/infra/i18n";
import { Button } from "src/components/elements";
import find from "lodash/find";
import clsx from "clsx";
import { useSymbologySpec } from "src/state/analysis";
import {
  RampSize,
  RangeColorRule,
  changeRampName,
  reverseColors,
} from "src/analysis/range-color-rule";
import { useCallback } from "react";
import { LinkSymbology, NodeSymbology } from "src/analysis/analysis-types";
import { useUserTracking } from "src/infra/user-tracking";

type ColorRampSettingsHook = {
  rampColors: string[];
  rampName: string;
  size: RampSize;
  isReversed: boolean;
  setRampName: (newName: string, isReversed: boolean) => void;
  reverseRampColors: () => void;
};

const useColorRule = (geometryType: "node" | "link"): ColorRampSettingsHook => {
  const {
    linkSymbology,
    nodeSymbology,
    updateNodeSymbology,
    updateLinkSymbology,
  } = useSymbologySpec();
  const userTracking = useUserTracking();

  const assetSymbology =
    geometryType === "node" ? nodeSymbology : linkSymbology;

  if (assetSymbology.type === "none")
    throw new Error("Cannot use settings with none");

  const colorRule = assetSymbology.colorRule;
  const numIntervals = colorRule.breaks.length + 1;
  const rampColors = colorRule.colors;
  const size = numIntervals as RampSize;
  const isReversed = Boolean(colorRule.reversedRamp);

  const updateSettings = useCallback(
    (newColorRule: RangeColorRule) => {
      if (geometryType === "node") {
        updateNodeSymbology({
          ...assetSymbology,
          colorRule: newColorRule,
        } as NodeSymbology);
      } else {
        updateLinkSymbology({
          ...assetSymbology,
          colorRule: newColorRule,
        } as LinkSymbology);
      }
    },
    [geometryType, assetSymbology, updateLinkSymbology, updateNodeSymbology],
  );

  const setRampName = useCallback(
    (newRampName: string, isReversed: boolean) => {
      userTracking.capture({
        name: "map.colorRamp.changed",
        rampName: newRampName,
        property: colorRule.property,
      });
      const newColorRule = changeRampName(colorRule, newRampName, isReversed);
      updateSettings(newColorRule);
    },
    [colorRule, updateSettings, userTracking],
  );

  const reverseRampColors = useCallback(() => {
    userTracking.capture({
      name: "map.colorRamp.reversed",
      rampName: colorRule.rampName,
      property: colorRule.property,
    });
    const newColorRule = reverseColors(colorRule);
    updateSettings(newColorRule);
  }, [colorRule, updateSettings, userTracking]);

  return {
    rampName: colorRule.rampName,
    rampColors,
    size,
    isReversed,
    setRampName,
    reverseRampColors,
  };
};

export const ColorRampSelector = ({
  geometryType,
}: {
  geometryType: "node" | "link";
}) => {
  const {
    rampName,
    rampColors,
    size,
    isReversed,
    setRampName,
    reverseRampColors,
  } = useColorRule(geometryType);

  const triggerStyles = clsx(
    "flex items-center gap-x-2 justify-between w-full min-w-[90px]",
    "border rounded-sm border-transparent hover:border-gray-300",
    "text-sm text-gray-700",
    "focus:ring-inset focus:ring-1 focus:ring-purple-500 focus:bg-purple-300/10",
    "px-2 py-2 min-h-9",
  );

  const contentStyles = `bg-white w-[--radix-select-trigger-width] border text-sm rounded-sm shadow-md z-50`;

  return (
    <Select.Root>
      <Select.Trigger
        tabIndex={1}
        aria-label={`${translate(geometryType)} ${translate("ramp")}`}
        className={triggerStyles}
        title={`${rampName}${isReversed ? " reversed" : ""}`}
      >
        <span
          className="cursor-pointer w-full h-5 border rounded-md"
          style={{
            background: linearGradient({
              colors: rampColors,
              interpolate: "step",
            }),
          }}
        ></span>
        <span className="px-1">
          <ChevronDownIcon />
        </span>
      </Select.Trigger>
      <Select.Content position="popper" className={contentStyles}>
        <Select.Viewport className="p-1">
          <div className="flex flex-col gap-y-2">
            <div className="py-2 flex flex-col gap-y-3 overflow-y-auto max-h-[320px]">
              <RampChoices
                label={translate("continuousRamp")}
                colors={[...COLORBREWER_SEQUENTIAL, ...CARTO_COLOR_SEQUENTIAL]}
                onSelect={(newRamp) => setRampName(newRamp, isReversed)}
                size={size}
                reverse={isReversed}
              />
              <RampChoices
                label={translate("divergingRamp")}
                colors={[...COLORBREWER_DIVERGING, ...CARTO_COLOR_DIVERGING]}
                onSelect={(newRamp) => setRampName(newRamp, isReversed)}
                size={size}
                reverse={isReversed}
              />
            </div>
            <div className="w-full p-2">
              <Button
                variant="quiet"
                size="full-width"
                onClick={reverseRampColors}
              >
                <UpdateIcon className="-rotate-90" />{" "}
                {translate("reverseColors")}
              </Button>
            </div>
          </div>
        </Select.Viewport>
      </Select.Content>
    </Select.Root>
  );
};

export function RampChoices({
  label,
  colors,
  onSelect,
  size,
  reverse,
}: {
  label: string;
  colors: CBColors[];
  onSelect?: (name: string) => void;
  size: keyof CBColors["colors"];
  reverse: boolean;
}) {
  return (
    <div className="flex flex-col gap-y-2 p-2">
      <span className="text-xs font-semibold text-gray-600 select-none">
        {label.toUpperCase()}
      </span>
      <div className="flex flex-col gap-y-2">
        {colors.map((ramp) => {
          return (
            <RampChoice
              key={ramp.name}
              ramp={ramp}
              size={size}
              onSelect={onSelect}
              reverse={reverse}
            />
          );
        })}
      </div>
    </div>
  );
}

function RampChoice({
  ramp,
  size = 7,
  reverse = false,
  onSelect,
}: {
  ramp: CBColors;
  reverse?: boolean;
  onSelect?: (name: string) => void;
  size?: keyof CBColors["colors"];
}) {
  return (
    <label
      key={ramp.name}
      className="hover:cursor-pointer hover:ring-1 dark:ring-white ring-gray-200 focus:ring-purple-300"
      onClick={() => onSelect && onSelect(ramp.name)}
      tabIndex={1}
    >
      <RampPreview
        name={ramp.name}
        classes={size}
        interpolate={"step"}
        reverse={reverse}
      />
    </label>
  );
}

const DEFAULT_CLASSES = 7;

function RampPreview({
  name,
  interpolate,
  classes,
  reverse = false,
}: {
  name: string;
  reverse?: boolean;
  interpolate: "linear" | "step";
  classes: number;
}) {
  const ramp = find(COLORBREWER_ALL, { name })!;
  const colors =
    ramp.colors[classes as keyof CBColors["colors"]]! ||
    ramp.colors[DEFAULT_CLASSES];

  return (
    <div
      title={name}
      className={clsx("w-full h-5 rounded-md", { "rotate-180": reverse })}
      style={{
        background: linearGradient({
          colors,
          interpolate,
        }),
      }}
    />
  );
}
