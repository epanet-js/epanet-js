import { ModelOperation } from "../model-operation";
import { ICurve } from "../curves";
import { Asset, AssetId, Pump } from "../asset-types";

type InputData = {
  pumpId: AssetId;
  points: { flow: number; head: number }[];
};

export const changeDefaultPumpCurve: ModelOperation<InputData> = (
  { assets },
  { pumpId, points },
) => {
  const pump = assets.get(pumpId) as Pump;
  if (!pump || pump.type !== "pump")
    throw new Error(`Invalid pump id ${pumpId}`);

  const curveId = String(pumpId);

  const updatedCurve: ICurve = {
    id: curveId,
    type: "pump",
    points: points.map(({ flow, head }) => ({ x: flow, y: head })),
  };

  const putAssets: Asset[] = [];
  const putCurves = new Map([[curveId, updatedCurve]]);
  if (pump.curveId !== curveId) {
    const pumpCopy = pump.copy();
    pumpCopy.setProperty("curveId", curveId);
    putAssets.push(pumpCopy);
  }

  return { note: "Change pump curve", putCurves };
};
