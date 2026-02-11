import { ModelOperation } from "../model-operation";
import { CurveId, CurvePoint, Curves } from "../curves";
import { AssetId, Pump } from "../asset-types";

type PumpDefinitionData =
  | { type: "power"; power: number }
  | { type: "curve"; curve: CurvePoint[] }
  | { type: "curveId"; curveId: CurveId };

type InputData = {
  pumpId: AssetId;
  data: PumpDefinitionData;
};

export const changePumpDefinition: ModelOperation<InputData> = (
  { assets, curves },
  { pumpId, data },
) => {
  const pump = assets.get(pumpId) as Pump;
  if (!pump || pump.type !== "pump")
    throw new Error(`Invalid pump id ${pumpId}`);

  const updatedPump = pump.copy();
  updatedPump.setProperty("definitionType", data.type);

  if (data.type === "power") {
    updatedPump.setProperty("power", data.power);
    delete updatedPump.feature.properties.curveId;
  } else if (data.type === "curve") {
    updatedPump.feature.properties.curve = data.curve.map((p) => ({ ...p }));
    delete updatedPump.feature.properties.curveId;
  } else {
    updatedPump.setProperty("curveId", data.curveId);
  }

  const oldCurveId =
    pump.definitionType === "curveId" ? pump.curveId : undefined;
  const newCurveId = data.type === "curveId" ? data.curveId : undefined;
  const putCurves = updateCurveAssetIds(curves, pumpId, oldCurveId, newCurveId);

  return {
    note: "Change pump curve",
    putAssets: [updatedPump],
    ...(putCurves && { putCurves }),
  };
};

const updateCurveAssetIds = (
  curves: Curves,
  pumpId: AssetId,
  oldCurveId: CurveId | undefined,
  newCurveId: CurveId | undefined,
): Curves | undefined => {
  if (oldCurveId === newCurveId) return undefined;

  const updated = new Map(curves);

  if (oldCurveId !== undefined) {
    const oldCurve = updated.get(oldCurveId);
    if (oldCurve) {
      const assetIds = new Set(oldCurve.assetIds);
      assetIds.delete(pumpId);
      updated.set(oldCurveId, { ...oldCurve, assetIds });
    }
  }

  if (newCurveId !== undefined) {
    const newCurve = updated.get(newCurveId);
    if (newCurve) {
      const assetIds = new Set(newCurve.assetIds);
      assetIds.add(pumpId);
      updated.set(newCurveId, { ...newCurve, assetIds });
    }
  }

  return updated;
};
