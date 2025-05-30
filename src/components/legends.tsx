import { linearGradient } from "src/lib/color";
import { translate, translateUnit } from "src/infra/i18n";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { useUserTracking } from "src/infra/user-tracking";
import { RangeColorRule } from "src/map/symbology/range-color-rule";
import { useAtomValue } from "jotai";
import { linkSymbologyAtom, nodeSymbologyAtom } from "src/state/symbology";
import { isFeatureOn } from "src/infra/feature-flags";

export const Legends = () => {
  const nodeSymbology = useAtomValue(nodeSymbologyAtom);
  const linkSymbology = useAtomValue(linkSymbologyAtom);

  return (
    <div className="space-y-1 absolute top-10 left-3 w-48">
      {!!nodeSymbology.colorRule && (
        <Legend symbology={nodeSymbology.colorRule} />
      )}
      {!!linkSymbology.colorRule && (
        <Legend symbology={linkSymbology.colorRule} />
      )}
    </div>
  );
};

const Legend = ({ symbology }: { symbology: RangeColorRule }) => {
  const userTracking = useUserTracking();
  const { breaks, colors, interpolate, property, unit } = symbology;

  const title = unit
    ? `${translate(property)} (${translateUnit(unit)})`
    : translate(property);

  return (
    <LegendContainer>
      <div
        className="block w-full p-2 flex flex-col justify-between items-start"
        onClick={() => {
          userTracking.capture({
            name: "legend.clicked",
            property,
          });
        }}
      >
        <div className="pb-2 text-xs text-wrap select-none">{title}</div>
        <div
          className="relative w-4 h-32 rounded dark:border dark:border-white "
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
                className="absolute left-full ml-2 text-xs whitespace-nowrap select-none"
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
      className={`space-y-1 text-xs
      bg-white dark:bg-gray-900
      dark:text-white
      border border-gray-300 dark:border-black w-32 rounded-sm ${!isFeatureOn("FLAG_MAP_TAB") ? "cursor-pointer hover:bg-gray-100" : ""} `}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
