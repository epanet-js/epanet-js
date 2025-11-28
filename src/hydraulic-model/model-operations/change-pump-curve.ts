import { ModelOperation } from "../model-operation";
import { CurveId, ICurve } from "../curves";
import { AssetId, Pump } from "../asset-types";

type PumpCurvePoint = { flow: number; head: number };

type PumpDefinitionData =
  | { type: "power"; power: number }
  | { type: "design-point"; curveId: CurveId; points: PumpCurvePoint[] }
  | { type: "standard"; curveId: CurveId; points: PumpCurvePoint[] };

type InputData = {
  pumpId: AssetId;
  data: PumpDefinitionData;
};

export const changePumpCurve: ModelOperation<InputData> = (
  { assets },
  { pumpId, data },
) => {
  const pump = assets.get(pumpId) as Pump;
  if (!pump || pump.type !== "pump")
    throw new Error(`Invalid pump id ${pumpId}`);

  const updatedPump = pump.copy();
  updatedPump.setProperty("definitionType", data.type);

  if (data.type === "power") {
    updatedPump.setProperty("power", data.power);
    return { note: "Change pump curve", putAssets: [updatedPump] };
  }

  const curveId = data.curveId;
  updatedPump.setProperty("curveId", curveId);

  const updatedCurve: ICurve = {
    id: curveId,
    type: "pump",
    points: data.points.map(({ flow, head }) => ({ x: flow, y: head })),
  };

  return {
    note: "Change pump curve",
    putAssets: [updatedPump],
    putCurves: [updatedCurve],
  };
};
