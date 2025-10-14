import { NumericField } from "src/components/form/numeric-field";
import { localizeDecimal } from "src/infra/i18n/numbers";

import { CheckType, EmptyState, ToolDescription, ToolHeader } from "./common";
import { useCallback, useState } from "react";
import { useAtomValue } from "jotai";
import { dataAtom } from "src/state/jotai";
import { useTranslate } from "src/hooks/use-translate";
import { convertTo } from "src/quantity";

export const ProximityCheck = ({ onGoBack }: { onGoBack: () => void }) => {
  const findJunctionsCloserThan = useCallback(() => {}, []);

  return (
    <div className="absolute inset-0 flex flex-col">
      <ToolHeader
        onGoBack={onGoBack}
        itemsCount={0}
        checkType={CheckType.proximityCheck}
      />
      <ToolDescription checkType={CheckType.proximityCheck} />
      <DistanceInput onChange={findJunctionsCloserThan} />
      <EmptyState checkType={CheckType.proximityCheck} />
    </div>
  );
};

const DEFAULT_DISTANCE_FT = 1.5;
const DEFAULT_DISTANCE_M = 0.5;

const DistanceInput = ({
  onChange,
}: {
  onChange: (distance: number) => void;
}) => {
  const translate = useTranslate();
  const {
    hydraulicModel: {
      units: { length: unit },
    },
  } = useAtomValue(dataAtom);
  const [distance, setDistance] = useState<number>(() =>
    unit === "ft" ? DEFAULT_DISTANCE_FT : DEFAULT_DISTANCE_M,
  );

  const label = `${translate("networkReview.proximityCheck.distance")} (${unit})`;

  const reportDistanceChange = useCallback(
    (value: number) => {
      const distanceInM = convertTo({ value, unit }, "m");
      setDistance(value);
      onChange(distanceInM);
    },
    [onChange, unit],
  );

  return (
    <div className="flex gap-2 flex-row p-3 items-center">
      <label className="pr-2 text-sm flex-1">{label}</label>
      <div className="flex-1">
        <NumericField
          label={label}
          displayValue={localizeDecimal(distance)}
          onChangeValue={reportDistanceChange}
          styleOptions={{ padding: "sm", textSize: "sm" }}
        />
      </div>
    </div>
  );
};
