import { Pipe, AssetId } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model";
import { Position } from "geojson";

interface EncodedCrossingPipe {
  pipe1Id: number;
  pipe2Id: number;
  intersectionPoint: Position;
}

export type EncodedCrossingPipes = EncodedCrossingPipe[];

export interface CrossingPipe {
  pipe1Id: AssetId;
  pipe2Id: AssetId;
  intersectionPoint: Position;
}

export function decodeCrossingPipes(
  model: HydraulicModel,
  linkIdsLookup: number[],
  encodedCrossingPipes: EncodedCrossingPipes,
): CrossingPipe[] {
  const crossingPipes: CrossingPipe[] = encodedCrossingPipes.map((encoded) => {
    const [pipe1Id, pipe2Id] = sortByDiameterAndLabel(
      model,
      linkIdsLookup[encoded.pipe1Id],
      linkIdsLookup[encoded.pipe2Id],
    );

    return {
      pipe1Id,
      pipe2Id,
      intersectionPoint: encoded.intersectionPoint,
    };
  });

  return crossingPipes.sort((a, b) => {
    const pipe1A = model.assets.get(a.pipe1Id) as Pipe;
    const pipe2A = model.assets.get(a.pipe2Id) as Pipe;
    const pipe1B = model.assets.get(b.pipe1Id) as Pipe;
    const pipe2B = model.assets.get(b.pipe2Id) as Pipe;

    if (diameterOrZero(pipe1A) === diameterOrZero(pipe1B)) {
      if (diameterOrZero(pipe2A) === diameterOrZero(pipe2B)) {
        return pipe1A.label.toUpperCase() < pipe1B.label.toUpperCase() ? -1 : 1;
      }
      return diameterOrZero(pipe2A) - diameterOrZero(pipe2B);
    }
    return diameterOrZero(pipe1A) - diameterOrZero(pipe1B);
  });
}

const diameterOrZero = (pipe: Pipe): number => pipe.diameter ?? 0;

function sortByDiameterAndLabel(
  model: HydraulicModel,
  pipeAId: AssetId,
  pipeBId: AssetId,
): [AssetId, AssetId] {
  const pipeAAsset = model.assets.get(pipeAId);
  const pipeBAsset = model.assets.get(pipeBId);

  const pipeA = pipeAAsset as Pipe;
  const pipeB = pipeBAsset as Pipe;

  if (diameterOrZero(pipeA) === diameterOrZero(pipeB)) {
    return pipeA.label.toUpperCase() < pipeB.label.toUpperCase()
      ? [pipeAId, pipeBId]
      : [pipeBId, pipeAId];
  }

  return diameterOrZero(pipeA) < diameterOrZero(pipeB)
    ? [pipeAId, pipeBId]
    : [pipeBId, pipeAId];
}

export interface EncodedPipe {
  id: number;
  startNode: number;
  endNode: number;
  bbox: [Position, Position];
}
