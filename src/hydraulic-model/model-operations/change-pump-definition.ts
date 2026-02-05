import { ModelOperation } from "../model-operation";
import { ICurve } from "../curves";
import { AssetId, Pump } from "../asset-types";

type PumpDefinitionData =
  | { type: "power"; power: number }
  | { type: "design-point"; curve: ICurve }
  | { type: "standard"; curve: ICurve };

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

  const { curve } = data;
  updatedPump.setProperty("curveId", curve.id);

  return {
    note: "Change pump curve",
    putAssets: [updatedPump],
    putCurves: [curve],
  };
};
