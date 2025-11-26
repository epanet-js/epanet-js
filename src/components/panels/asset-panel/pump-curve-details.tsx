import { useTranslate } from "src/hooks/use-translate";
import { NumericField } from "src/components/form/numeric-field";
import { ICurve } from "src/hydraulic-model/curves";
import { Quantities } from "src/model-metadata/quantities-spec";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { CollapsibleSection } from "src/components/form/fields";

export const PumpCurveDetails = ({
  curve,
  quantities,
}: {
  curve: ICurve;
  quantities: Quantities;
}) => {
  const translate = useTranslate();
  return (
    <CollapsibleSection
      title={translate("curveDetails")}
      variant="secondary"
      defaultOpen={true}
      className="bg-gray-50 rounded-md "
    >
      <PumpCurveTable curve={curve} quantities={quantities} />
    </CollapsibleSection>
  );
};

export const PumpCurveTable = ({
  curve,
  quantities,
}: {
  curve: ICurve;
  quantities: Quantities;
}) => {
  const translate = useTranslate();

  const flowDecimals = quantities.getDecimals("flow") ?? 2;
  const headDecimals = quantities.getDecimals("head") ?? 2;

  const displayPoints = getStandardCurvePoints(curve);

  const pointLabels = [
    translate("shutoffPoint"),
    translate("designPointLabel"),
    translate("maxOperatingPoint"),
  ];

  return (
    <table className="w-full">
      <TableHeader quantities={quantities} />
      <tbody>
        {displayPoints.map((point, index) => (
          <TableRow
            key={pointLabels[index]}
            label={pointLabels[index]}
            displayFlow={localizeDecimal(point.flow, {
              decimals: flowDecimals,
            })}
            displayHead={localizeDecimal(point.head, {
              decimals: headDecimals,
            })}
          />
        ))}
      </tbody>
    </table>
  );
};

const TableHeader = ({ quantities }: { quantities: Quantities }) => {
  const translate = useTranslate();
  const flowUnit = quantities.getUnit("flow");
  const headUnit = quantities.getUnit("head");

  return (
    <thead>
      <tr>
        <th className="px-2 py-1 text-xs font-medium text-gray-700 text-left">
          {translate("curvePoint")}
        </th>
        <th className="px-2 py-1 text-xs font-medium text-gray-700 text-left">
          {translate("flow")} ({flowUnit})
        </th>
        <th className="px-2 py-1 text-xs font-medium text-gray-700 text-left">
          {translate("head")} ({headUnit})
        </th>
      </tr>
    </thead>
  );
};

const TableRow = ({
  label,
  displayFlow,
  displayHead,
  onChangeFlow,
  onChangeHead,
}: {
  label: string;
  displayFlow: string;
  displayHead: string;
  onChangeFlow?: (newValue: number) => void;
  onChangeHead?: (newValue: number) => void;
}) => {
  return (
    <tr>
      <td className="px-3 py-2 text-xs text-gray-700 align-middle">{label}</td>
      <td className="px-3 py-2 align-middle">
        <NumericField
          label={`${label}-x`}
          positiveOnly={true}
          isNullable={false}
          readOnly={!onChangeFlow}
          displayValue={displayFlow}
          onChangeValue={onChangeFlow}
          styleOptions={{
            padding: "sm",
            ghostBorder: !onChangeFlow,
            textSize: "xs",
          }}
        />
      </td>
      <td className="px-3 py-2 align-middle">
        <NumericField
          label={`${label}-y`}
          positiveOnly={true}
          isNullable={false}
          readOnly={!onChangeHead}
          displayValue={displayHead}
          onChangeValue={onChangeHead}
          styleOptions={{
            padding: "sm",
            ghostBorder: !onChangeHead,
            textSize: "xs",
          }}
        />
      </td>
    </tr>
  );
};

interface PumpCurvePoint {
  flow: number;
  head: number;
}

const getStandardCurvePoints = (curve: ICurve): PumpCurvePoint[] => {
  if (curve.points.length > 1)
    return curve.points.map(({ x, y }) => ({ flow: x, head: y }));

  const { x: designFlow, y: designHead } = curve.points[0];

  return [
    { flow: 0, head: designHead * 1.33 },
    { flow: designFlow, head: designHead },
    { flow: designFlow * 2, head: 0 },
  ];
};
