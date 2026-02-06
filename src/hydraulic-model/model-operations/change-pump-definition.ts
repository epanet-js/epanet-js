import { ModelOperation } from "../model-operation";
import { CurveId, CurvePoint } from "../curves";
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

  if (data.type === "curve") {
    updatedPump.feature.properties.curve = data.curve.map((p) => ({ ...p }));
    return { note: "Change pump curve", putAssets: [updatedPump] };
  }

  updatedPump.setProperty("curveId", data.curveId);
  return { note: "Change pump curve", putAssets: [updatedPump] };
};
